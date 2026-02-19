import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers/db";
import {
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers/factories";
import { NotificationPreference } from "@/models/notification-preference";
import { Task } from "@/models/task";

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import {
  computeReminderDate,
  scheduleNextReminder,
  recalculateRemindersForUser,
} from "./reminder-scheduler";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

describe("computeReminderDate", () => {
  it("computes correct UTC date for daysBefore=1 at 09:00 in UTC", () => {
    // Due date: 2026-03-15 (stored as midnight UTC)
    const dueDate = new Date("2026-03-15T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 1, time: "09:00" },
      "UTC",
    );

    // Should be March 14 at 09:00 UTC
    expect(result.toISOString()).toBe("2026-03-14T09:00:00.000Z");
  });

  it("computes correct UTC date for day-of (daysBefore=0) at 08:00 in UTC", () => {
    const dueDate = new Date("2026-03-15T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 0, time: "08:00" },
      "UTC",
    );

    expect(result.toISOString()).toBe("2026-03-15T08:00:00.000Z");
  });

  it("applies timezone offset for America/New_York (UTC-5 in winter)", () => {
    // Due date: 2026-01-20 (winter, EST = UTC-5)
    const dueDate = new Date("2026-01-20T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 1, time: "09:00" },
      "America/New_York",
    );

    // 09:00 EST = 14:00 UTC on Jan 19
    expect(result.toISOString()).toBe("2026-01-19T14:00:00.000Z");
  });

  it("applies timezone offset for Asia/Tokyo (UTC+9)", () => {
    // Due date: 2026-03-15
    const dueDate = new Date("2026-03-15T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 0, time: "20:00" },
      "Asia/Tokyo",
    );

    // 20:00 JST = 11:00 UTC on March 15
    expect(result.toISOString()).toBe("2026-03-15T11:00:00.000Z");
  });

  it("handles daysBefore=7 (one week before)", () => {
    const dueDate = new Date("2026-03-20T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 7, time: "10:00" },
      "UTC",
    );

    expect(result.toISOString()).toBe("2026-03-13T10:00:00.000Z");
  });

  it("handles month boundary crossing", () => {
    // Due date: March 2, daysBefore=3 → February 27
    const dueDate = new Date("2026-03-02T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 3, time: "09:00" },
      "UTC",
    );

    expect(result.toISOString()).toBe("2026-02-27T09:00:00.000Z");
  });

  it("handles evening time on day-of", () => {
    const dueDate = new Date("2026-03-15T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 0, time: "20:00" },
      "UTC",
    );

    expect(result.toISOString()).toBe("2026-03-15T20:00:00.000Z");
  });

  it("handles month boundary with timezone offset (Asia/Tokyo, Jan 31 → Feb 1)", () => {
    // Due Feb 1, daysBefore=1 → reminder on Jan 31
    // 20:00 JST on Jan 31 = 11:00 UTC on Jan 31
    // The UTC guess (Jan 31 20:00 UTC) in JST is Feb 1 05:00 — crosses month boundary
    const dueDate = new Date("2026-02-01T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 1, time: "20:00" },
      "Asia/Tokyo",
    );

    expect(result.toISOString()).toBe("2026-01-31T11:00:00.000Z");
  });

  it("handles month boundary with negative UTC offset (America/New_York, Feb 1)", () => {
    // Due Feb 1, daysBefore=0 → reminder on Feb 1
    // 01:00 EST on Feb 1 = 06:00 UTC on Feb 1
    // The UTC guess (Feb 1 01:00 UTC) in EST is Jan 31 20:00 — crosses month boundary backward
    const dueDate = new Date("2026-02-01T00:00:00Z");
    const result = computeReminderDate(
      dueDate,
      { daysBefore: 0, time: "01:00" },
      "America/New_York",
    );

    expect(result.toISOString()).toBe("2026-02-01T06:00:00.000Z");
  });
});

describe("scheduleNextReminder", () => {
  it("sets reminderAt to the soonest future due date reminder", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Due in 3 days from now
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "Test reminder scheduling",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    // User has reminders: 1 day before at 09:00, day-of at 08:00
    await NotificationPreference.create({
      userId: user._id,
      dueDateReminders: [
        { daysBefore: 1, time: "09:00" },
        { daysBefore: 0, time: "08:00" },
      ],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    // The soonest future reminder should be 1 day before at 09:00 UTC
    const expected = computeReminderDate(
      dueDate,
      { daysBefore: 1, time: "09:00" },
      "UTC",
    );
    expect(updated!.reminderAt!.getTime()).toBe(expected.getTime());
  });

  it("picks day-of reminder when day-before is already past", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Due tomorrow (less than 1 day away) — construct a date where
    // "1 day before at 09:00" is in the past but "day-of at 08:00" is in the future
    const now = new Date();
    // Set dueDate to tomorrow
    const dueDate = new Date(now);
    dueDate.setUTCDate(dueDate.getUTCDate() + 1);
    dueDate.setUTCHours(0, 0, 0, 0);

    const task = await createTestTask({
      title: "Due tomorrow",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    // "1 day before at 09:00" would be today at 09:00 — may be in the past
    // "day-of at 23:00" will be tomorrow at 23:00 — definitely in the future
    await NotificationPreference.create({
      userId: user._id,
      dueDateReminders: [
        { daysBefore: 7, time: "09:00" }, // definitely past
        { daysBefore: 0, time: "23:00" }, // tomorrow at 23:00, definitely future
      ],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expectedDayOf = computeReminderDate(
      dueDate,
      { daysBefore: 0, time: "23:00" },
      "UTC",
    );
    expect(updated!.reminderAt!.getTime()).toBe(expectedDayOf.getTime());
  });

  it("does nothing when no dueDateReminders are configured", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "No reminders",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: user._id,
      dueDateReminders: [],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeUndefined();
  });

  it("does nothing when no preferences exist for user", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "No prefs",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeUndefined();
  });

  it("does nothing when all reminder times are in the past", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Due today (or very soon), all reminders would be in the past
    const dueDate = new Date();
    dueDate.setUTCHours(0, 0, 0, 0); // midnight today UTC — already past
    const task = await createTestTask({
      title: "All past",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: user._id,
      dueDateReminders: [
        { daysBefore: 1, time: "09:00" }, // yesterday at 09:00 — past
        { daysBefore: 0, time: "00:00" }, // today at 00:00 — past
      ],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeUndefined();
  });

  it("does not overwrite an existing custom task reminder (reminderAt)", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const customReminder = new Date(Date.now() + 30 * 60_000);
    const task = await createTestTask({
      title: "Custom reminder task",
      userId: user._id,
      projectId: project._id,
      dueDate,
      reminderAt: customReminder,
    });

    await NotificationPreference.create({
      userId: user._id,
      dueDateReminders: [
        { daysBefore: 1, time: "09:00" },
        { daysBefore: 0, time: "08:00" },
      ],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    // Should NOT overwrite — keep the manually-set custom reminder
    expect(updated!.reminderAt!.getTime()).toBe(customReminder.getTime());
  });

  it("does nothing when task has no dueDate", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    const task = await createTestTask({
      title: "No due date",
      userId: user._id,
      projectId: project._id,
    });

    await NotificationPreference.create({
      userId: user._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeUndefined();
  });

  it("does nothing for a nonexistent task", async () => {
    // Should not throw
    await scheduleNextReminder("000000000000000000000000");
  });

  it("merges owner and assignee due date reminders", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const assignee = await createTestUser({ email: "assignee@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    // Due in 3 days
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "Shared task",
      userId: owner._id,
      projectId: project._id,
      assigneeId: assignee._id,
      dueDate,
    });

    // Owner: 2 days before at 10:00; Assignee: 1 day before at 09:00
    await NotificationPreference.create({
      userId: owner._id,
      dueDateReminders: [{ daysBefore: 2, time: "10:00" }],
      timezone: "UTC",
    });
    await NotificationPreference.create({
      userId: assignee._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    // Soonest future: 2 days before at 10:00 (earlier than 1 day before at 09:00)
    const expectedOwner = computeReminderDate(
      dueDate,
      { daysBefore: 2, time: "10:00" },
      "UTC",
    );
    expect(updated!.reminderAt!.getTime()).toBe(expectedOwner.getTime());
  });

  it("uses assignee-only reminders when owner has no preferences", async () => {
    const owner = await createTestUser({ email: "owner2@test.com" });
    const assignee = await createTestUser({ email: "assignee2@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "Assignee-only prefs",
      userId: owner._id,
      projectId: project._id,
      assigneeId: assignee._id,
      dueDate,
    });

    // Only assignee has preferences
    await NotificationPreference.create({
      userId: assignee._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expected = computeReminderDate(
      dueDate,
      { daysBefore: 1, time: "09:00" },
      "UTC",
    );
    expect(updated!.reminderAt!.getTime()).toBe(expected.getTime());
  });

  it("respects each user's timezone when merging reminders", async () => {
    const owner = await createTestUser({ email: "tz-owner@test.com" });
    const assignee = await createTestUser({ email: "tz-assignee@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    // Due in 3 days from now
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "Cross-timezone task",
      userId: owner._id,
      projectId: project._id,
      assigneeId: assignee._id,
      dueDate,
    });

    // Owner in UTC: 1 day before at 09:00 → day-1 at 09:00 UTC
    await NotificationPreference.create({
      userId: owner._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "UTC",
    });
    // Assignee in Asia/Tokyo (UTC+9): 1 day before at 09:00 → day-1 at 00:00 UTC
    await NotificationPreference.create({
      userId: assignee._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "Asia/Tokyo",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    // Tokyo 09:00 = UTC 00:00, which is earlier than UTC 09:00
    const tokyoReminder = computeReminderDate(
      dueDate,
      { daysBefore: 1, time: "09:00" },
      "Asia/Tokyo",
    );
    expect(updated!.reminderAt!.getTime()).toBe(tokyoReminder.getTime());
  });

  it("works with no assignee (owner-only)", async () => {
    const owner = await createTestUser({ email: "solo@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "No assignee",
      userId: owner._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: owner._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "UTC",
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expected = computeReminderDate(
      dueDate,
      { daysBefore: 1, time: "09:00" },
      "UTC",
    );
    expect(updated!.reminderAt!.getTime()).toBe(expected.getTime());
  });
});

describe("recalculateRemindersForUser", () => {
  it("recalculates reminderAt for incomplete future tasks", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Create initial preference: 1 day before at 09:00
    await NotificationPreference.create({
      userId: user._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "UTC",
    });

    // Task due in 5 days (should be recalculated)
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60_000);
    const futureTask = await createTestTask({
      title: "Future task",
      userId: user._id,
      projectId: project._id,
      dueDate,
      reminderAt: new Date(Date.now() + 2 * 24 * 60 * 60_000), // old reminder
    });

    // Completed task (should NOT be recalculated)
    const completedTask = await createTestTask({
      title: "Completed task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60_000),
      completedAt: new Date(),
    });

    // Past dueDate task (should NOT be recalculated)
    const pastTask = await createTestTask({
      title: "Past task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000),
    });

    // Change preference to day-of at 08:00
    await NotificationPreference.findOneAndUpdate(
      { userId: user._id },
      { dueDateReminders: [{ daysBefore: 0, time: "08:00" }] },
    );

    await recalculateRemindersForUser(user._id.toString());

    // Future task should have new reminderAt: day-of at 08:00 UTC
    const updatedFuture = await Task.findById(futureTask._id);
    expect(updatedFuture?.reminderAt).toBeDefined();
    const expectedDayOf = computeReminderDate(
      dueDate,
      { daysBefore: 0, time: "08:00" },
      "UTC",
    );
    expect(updatedFuture!.reminderAt!.getTime()).toBe(expectedDayOf.getTime());

    // Completed task should be unaffected
    const updatedCompleted = await Task.findById(completedTask._id);
    expect(updatedCompleted?.reminderAt).toBeUndefined();

    // Past task should be unaffected
    const updatedPast = await Task.findById(pastTask._id);
    expect(updatedPast?.reminderAt).toBeUndefined();
  });

  it("handles no matching tasks gracefully", async () => {
    const user = await createTestUser();

    // Should not throw
    await recalculateRemindersForUser(user._id.toString());
  });

  it("recalculates tasks where user is assignee", async () => {
    const owner = await createTestUser({ email: "recalc-owner@test.com" });
    const assignee = await createTestUser({
      email: "recalc-assignee@test.com",
    });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    await NotificationPreference.create({
      userId: owner._id,
      dueDateReminders: [{ daysBefore: 2, time: "10:00" }],
      timezone: "UTC",
    });
    await NotificationPreference.create({
      userId: assignee._id,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
      timezone: "UTC",
    });

    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "Assigned task",
      userId: owner._id,
      projectId: project._id,
      assigneeId: assignee._id,
      dueDate,
      reminderAt: new Date(Date.now() + 1 * 24 * 60 * 60_000), // old
    });

    // Recalculate for assignee — should still merge both users' reminders
    await recalculateRemindersForUser(assignee._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    // Merged: owner 2-days-before@10:00 + assignee 1-day-before@09:00
    // Soonest is 2 days before at 10:00
    const expected = computeReminderDate(
      dueDate,
      { daysBefore: 2, time: "10:00" },
      "UTC",
    );
    expect(updated!.reminderAt!.getTime()).toBe(expected.getTime());
  });
});
