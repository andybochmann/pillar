import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers/db";
import {
  createTestUser,
  createTestAccount,
  createTestCalendarSync,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers/factories";
import { CalendarSync } from "@/models/calendar-sync";
import { Task } from "@/models/task";

const session = vi.hoisted(() => ({
  user: { id: "000000000000000000000000", name: "Test User", email: "test@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/google-calendar", () => ({
  bulkSyncTasksToCalendar: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
}));

import { GET, PATCH, DELETE } from "./route";

beforeAll(async () => {
  await setupTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

async function setupUser() {
  const user = await createTestUser();
  session.user.id = user._id.toString();
  return user;
}

describe("GET /api/settings/calendar", () => {
  it("returns default status when no calendar connected", async () => {
    await setupUser();

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connected).toBe(false);
    expect(data.enabled).toBe(false);
  });

  it("returns connected status when tokens exist", async () => {
    const user = await setupUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "token",
      refresh_token: "refresh",
      scope: "https://www.googleapis.com/auth/calendar.events openid",
    });
    await createTestCalendarSync({ userId: user._id, enabled: true });

    const res = await GET();
    const data = await res.json();

    expect(data.connected).toBe(true);
    expect(data.enabled).toBe(true);
  });
});

describe("PATCH /api/settings/calendar", () => {
  it("returns 400 when not connected", async () => {
    await setupUser();

    const req = new Request("http://localhost/api/settings/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("enables sync when connected", async () => {
    const user = await setupUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      refresh_token: "refresh",
      scope: "https://www.googleapis.com/auth/calendar.events openid",
    });

    const req = new Request("http://localhost/api/settings/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enabled).toBe(true);
  });

  it("disables sync", async () => {
    const user = await setupUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      refresh_token: "refresh",
      scope: "https://www.googleapis.com/auth/calendar.events openid",
    });
    await createTestCalendarSync({ userId: user._id, enabled: true });

    const req = new Request("http://localhost/api/settings/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    const res = await PATCH(req);
    const data = await res.json();

    expect(data.enabled).toBe(false);
  });
});

describe("DELETE /api/settings/calendar", () => {
  it("disconnects calendar and clears event ids", async () => {
    const user = await setupUser();
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-123",
      access_token: "token",
      refresh_token: "refresh",
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
    await Task.updateOne(
      { _id: task._id },
      { googleCalendarEventId: "gcal-event-1" },
    );

    const res = await DELETE();
    expect(res.status).toBe(200);

    // Verify CalendarSync deleted
    const sync = await CalendarSync.findOne({ userId: user._id });
    expect(sync).toBeNull();

    // Verify event ID cleared from task
    const updatedTask = await Task.findById(task._id);
    expect(updatedTask?.googleCalendarEventId).toBeUndefined();
  });
});
