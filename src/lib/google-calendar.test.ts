import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers/db";
import {
  createTestUser,
  createTestAccount,
  createTestCalendarSync,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers/factories";
import { Account } from "@/models/account";
import { CalendarSync } from "@/models/calendar-sync";
import { Task } from "@/models/task";

// Mock connectDB since tests use setupTestDB directly
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

// Mock project-access — we control accessible project IDs in bulk sync tests
const mockGetAccessibleProjectIds = vi.fn();
vi.mock("@/lib/project-access", () => ({
  getAccessibleProjectIds: (...args: unknown[]) => mockGetAccessibleProjectIds(...args),
}));

// We'll mock fetch for Google API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeAll(async () => {
  await setupTestDB();
});

afterEach(async () => {
  await clearTestDB();
  mockFetch.mockReset();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await teardownTestDB();
});

// Import after mocks are set up
const {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  syncTaskToCalendar,
  removeTaskFromCalendar,
  bulkSyncTasksToCalendar,
} = await import("./google-calendar");

describe("getValidAccessToken", () => {
  it("returns existing token if not expired", async () => {
    const user = await createTestUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "valid-token",
      refresh_token: "refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      scope: "calendar.events",
    });

    const token = await getValidAccessToken(user._id.toString());
    expect(token).toBe("valid-token");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when no account exists", async () => {
    const user = await createTestUser();
    const token = await getValidAccessToken(user._id.toString());
    expect(token).toBeNull();
  });

  it("returns null when no refresh token", async () => {
    const user = await createTestUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "expired-token",
      expires_at: Math.floor(Date.now() / 1000) - 100,
      scope: "calendar.events",
    });

    const token = await getValidAccessToken(user._id.toString());
    expect(token).toBeNull();
  });

  it("refreshes token when expired", async () => {
    const user = await createTestUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "expired-token",
      refresh_token: "refresh-token",
      expires_at: Math.floor(Date.now() / 1000) - 100,
      scope: "calendar.events",
    });
    await createTestCalendarSync({ userId: user._id });

    // Set env vars for refresh
    vi.stubEnv("AUTH_GOOGLE_ID", "test-client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "test-client-secret");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-token",
        expires_in: 3600,
      }),
    });

    const token = await getValidAccessToken(user._id.toString());
    expect(token).toBe("new-token");

    // Verify token was saved to DB
    const updated = await Account.findOne({
      userId: user._id,
      provider: "google",
    });
    expect(updated?.access_token).toBe("new-token");

    vi.unstubAllEnvs();
  });
});

describe("createCalendarEvent", () => {
  it("creates an event and returns the id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "event-123" }),
    });

    const eventId = await createCalendarEvent("token", "primary", {
      summary: "Test Task",
      start: { date: "2026-03-01" },
      end: { date: "2026-03-02" },
    });

    expect(eventId).toBe("event-123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/calendars/primary/events"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const eventId = await createCalendarEvent("token", "primary", {
      summary: "Test",
      start: { date: "2026-03-01" },
      end: { date: "2026-03-02" },
    });

    expect(eventId).toBeNull();
  });
});

describe("updateCalendarEvent", () => {
  it("updates an event and returns true", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const result = await updateCalendarEvent("token", "primary", "event-123", {
      summary: "Updated",
      start: { date: "2026-03-01" },
      end: { date: "2026-03-02" },
    });

    expect(result).toBe(true);
  });

  it("returns false on 404", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await updateCalendarEvent("token", "primary", "deleted-event", {
      summary: "Updated",
      start: { date: "2026-03-01" },
      end: { date: "2026-03-02" },
    });

    expect(result).toBe(false);
  });
});

describe("deleteCalendarEvent", () => {
  it("deletes an event and returns true", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await deleteCalendarEvent("token", "primary", "event-123");
    expect(result).toBe(true);
  });

  it("returns true on 404 (already deleted)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await deleteCalendarEvent("token", "primary", "event-123");
    expect(result).toBe(true);
  });
});

describe("syncTaskToCalendar", () => {
  it("skips when sync is not enabled", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });
    const task = await createTestTask({
      userId: user._id,
      projectId: project._id,
      dueDate: new Date("2026-04-01"),
    });

    await syncTaskToCalendar(task, user._id.toString());
    // No CalendarSync record → no fetch calls
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("creates event and stores eventId on task", async () => {
    const user = await createTestUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "valid-token",
      refresh_token: "refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      scope: "calendar.events",
    });
    await createTestCalendarSync({ userId: user._id, enabled: true });

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });
    const task = await createTestTask({
      userId: user._id,
      projectId: project._id,
      dueDate: new Date("2026-04-01"),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "gcal-event-1" }),
    });

    await syncTaskToCalendar(task, user._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.googleCalendarEventId).toBe("gcal-event-1");
  });
});

describe("removeTaskFromCalendar", () => {
  it("skips when task has no calendar event id", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });
    const task = await createTestTask({
      userId: user._id,
      projectId: project._id,
    });

    await removeTaskFromCalendar(task, user._id.toString());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("deletes event and clears eventId from task", async () => {
    const user = await createTestUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "valid-token",
      refresh_token: "refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      scope: "calendar.events",
    });
    await createTestCalendarSync({ userId: user._id, enabled: true });

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });
    const task = await createTestTask({
      userId: user._id,
      projectId: project._id,
      dueDate: new Date("2026-04-01"),
    });
    await Task.updateOne({ _id: task._id }, { googleCalendarEventId: "gcal-event-1" });

    mockFetch.mockResolvedValueOnce({ ok: true });

    const taskWithEventId = await Task.findById(task._id);
    await removeTaskFromCalendar(taskWithEventId!, user._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.googleCalendarEventId).toBeUndefined();
  });
});

describe("bulkSyncTasksToCalendar", () => {
  it("syncs incomplete tasks with future due dates", async () => {
    const user = await createTestUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "valid-token",
      refresh_token: "refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      scope: "calendar.events",
    });
    await createTestCalendarSync({ userId: user._id, enabled: true });

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Create tasks - one with future date, one completed, one with past date
    await createTestTask({
      userId: user._id,
      projectId: project._id,
      title: "Future task",
      dueDate: new Date("2027-06-01"),
    });
    await createTestTask({
      userId: user._id,
      projectId: project._id,
      title: "Completed task",
      dueDate: new Date("2027-06-01"),
      completedAt: new Date(),
    });
    await createTestTask({
      userId: user._id,
      projectId: project._id,
      title: "Past task",
      dueDate: new Date("2020-01-01"),
    });

    mockGetAccessibleProjectIds.mockResolvedValueOnce([project._id.toString()]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: `gcal-${Date.now()}` }),
    });

    const result = await bulkSyncTasksToCalendar(user._id.toString());

    // Only the future incomplete task should be synced
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
  });
});
