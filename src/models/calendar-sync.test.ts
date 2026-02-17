import { describe, it, expect, afterEach, afterAll, beforeAll } from "vitest";
import { CalendarSync } from "./calendar-sync";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers/db";
import { createTestUser, createTestCalendarSync } from "@/test/helpers/factories";

beforeAll(async () => {
  await setupTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("CalendarSync model", () => {
  it("creates a calendar sync record with defaults", async () => {
    const user = await createTestUser();
    const sync = await CalendarSync.create({ userId: user._id });

    expect(sync.userId.toString()).toBe(user._id.toString());
    expect(sync.enabled).toBe(false);
    expect(sync.calendarId).toBe("primary");
    expect(sync.syncErrors).toBe(0);
    expect(sync.lastSyncError).toBeUndefined();
    expect(sync.lastSyncAt).toBeUndefined();
  });

  it("enforces unique userId constraint", async () => {
    const user = await createTestUser();
    await createTestCalendarSync({ userId: user._id });

    await expect(
      CalendarSync.create({ userId: user._id }),
    ).rejects.toThrow();
  });

  it("stores sync error info", async () => {
    const user = await createTestUser();
    const sync = await createTestCalendarSync({
      userId: user._id,
      syncErrors: 3,
      lastSyncError: "Token refresh failed: 401",
    });

    expect(sync.syncErrors).toBe(3);
    expect(sync.lastSyncError).toBe("Token refresh failed: 401");
  });

  it("stores lastSyncAt timestamp", async () => {
    const user = await createTestUser();
    const now = new Date();
    const sync = await createTestCalendarSync({
      userId: user._id,
      lastSyncAt: now,
    });

    expect(sync.lastSyncAt).toEqual(now);
  });
});
