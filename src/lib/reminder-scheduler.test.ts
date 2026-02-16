import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
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

import { scheduleNextReminder, recalculateRemindersForUser } from "./reminder-scheduler";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

describe("scheduleNextReminder", () => {
  it("sets reminderAt to the soonest future timing before dueDate", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Due in 2 hours from now
    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
    const task = await createTestTask({
      title: "Test reminder scheduling",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    // User has timings: 1 day before (1440 min), 1 hour before (60 min), 15 min before
    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      reminderTimings: [1440, 60, 15],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    // The soonest future timing should be 1 hour before (60 min)
    // since 1 day before is already in the past (dueDate is 2 hours from now)
    const expectedReminder = new Date(dueDate.getTime() - 60 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expectedReminder.getTime());
  });

  it("picks the 15-minute timing when 1-hour timing is already past", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Due in 30 minutes from now
    const dueDate = new Date(Date.now() + 30 * 60_000);
    const task = await createTestTask({
      title: "Soon task",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      reminderTimings: [1440, 60, 15],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expectedReminder = new Date(dueDate.getTime() - 15 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expectedReminder.getTime());
  });

  it("does nothing when no reminderTimings are configured", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
    const task = await createTestTask({
      title: "No timings",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      reminderTimings: [],
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

    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
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

  it("does nothing when all timings are in the past", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Due in 5 minutes — all timings (15, 60, 1440 min) are already past
    const dueDate = new Date(Date.now() + 5 * 60_000);
    const task = await createTestTask({
      title: "All past",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      reminderTimings: [1440, 60, 15],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeUndefined();
  });

  it("does not overwrite an existing manually-set reminderAt", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
    const manualReminder = new Date(Date.now() + 30 * 60_000);
    const task = await createTestTask({
      title: "Manual reminder",
      userId: user._id,
      projectId: project._id,
      dueDate,
      reminderAt: manualReminder,
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      reminderTimings: [1440, 60, 15],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    // Should NOT overwrite — keep the manually-set reminder
    expect(updated!.reminderAt!.getTime()).toBe(manualReminder.getTime());
  });

  it("handles single timing correctly", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    // Due in 2 days
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60_000);
    const task = await createTestTask({
      title: "Single timing",
      userId: user._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      reminderTimings: [1440], // only 1 day before
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expectedReminder = new Date(dueDate.getTime() - 1440 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expectedReminder.getTime());
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
      enableInAppNotifications: true,
      reminderTimings: [60],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeUndefined();
  });

  it("does nothing for a nonexistent task", async () => {
    // Should not throw
    await scheduleNextReminder("000000000000000000000000");
  });

  it("merges owner and assignee timings", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const assignee = await createTestUser({ email: "assignee@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    // Due in 2 hours
    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
    const task = await createTestTask({
      title: "Shared task",
      userId: owner._id,
      projectId: project._id,
      assigneeId: assignee._id,
      dueDate,
    });

    // Owner has 60 min timing, assignee has 15 min timing
    await NotificationPreference.create({
      userId: owner._id,
      enableInAppNotifications: true,
      reminderTimings: [60],
    });
    await NotificationPreference.create({
      userId: assignee._id,
      enableInAppNotifications: true,
      reminderTimings: [15],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    // Soonest future reminder from merged set {60, 15} is 60 min before
    const expectedReminder = new Date(dueDate.getTime() - 60 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expectedReminder.getTime());
  });

  it("uses assignee-only timings when owner has no preferences", async () => {
    const owner = await createTestUser({ email: "owner2@test.com" });
    const assignee = await createTestUser({ email: "assignee2@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    // Due in 2 hours
    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
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
      enableInAppNotifications: true,
      reminderTimings: [60],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expectedReminder = new Date(dueDate.getTime() - 60 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expectedReminder.getTime());
  });

  it("deduplicates identical timings from owner and assignee", async () => {
    const owner = await createTestUser({ email: "owner3@test.com" });
    const assignee = await createTestUser({ email: "assignee3@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    // Due in 2 hours
    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
    const task = await createTestTask({
      title: "Same timings",
      userId: owner._id,
      projectId: project._id,
      assigneeId: assignee._id,
      dueDate,
    });

    // Both have the same timing
    await NotificationPreference.create({
      userId: owner._id,
      enableInAppNotifications: true,
      reminderTimings: [60],
    });
    await NotificationPreference.create({
      userId: assignee._id,
      enableInAppNotifications: true,
      reminderTimings: [60],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expectedReminder = new Date(dueDate.getTime() - 60 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expectedReminder.getTime());
  });

  it("works with no assignee (owner-only)", async () => {
    const owner = await createTestUser({ email: "solo@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    const dueDate = new Date(Date.now() + 2 * 60 * 60_000);
    const task = await createTestTask({
      title: "No assignee",
      userId: owner._id,
      projectId: project._id,
      dueDate,
    });

    await NotificationPreference.create({
      userId: owner._id,
      enableInAppNotifications: true,
      reminderTimings: [60],
    });

    await scheduleNextReminder(task._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    const expectedReminder = new Date(dueDate.getTime() - 60 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expectedReminder.getTime());
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

    // Create initial preference with 60 min timing
    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      reminderTimings: [60],
    });

    // Task with future dueDate (should be recalculated)
    const dueDate = new Date(Date.now() + 4 * 60 * 60_000); // 4 hours from now
    const futureTask = await createTestTask({
      title: "Future task",
      userId: user._id,
      projectId: project._id,
      dueDate,
      reminderAt: new Date(dueDate.getTime() - 60 * 60_000), // old reminder
    });

    // Completed task (should NOT be recalculated)
    const completedTask = await createTestTask({
      title: "Completed task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() + 2 * 60 * 60_000),
      completedAt: new Date(),
    });

    // Past dueDate task (should NOT be recalculated)
    const pastTask = await createTestTask({
      title: "Past task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 60 * 60_000), // 1 hour ago
    });

    // Change preference to 15 min timing
    await NotificationPreference.findOneAndUpdate(
      { userId: user._id },
      { reminderTimings: [15] },
    );

    await recalculateRemindersForUser(user._id.toString());

    // Future task should have new reminderAt (15 min before due)
    const updatedFuture = await Task.findById(futureTask._id);
    expect(updatedFuture?.reminderAt).toBeDefined();
    const expected15Min = new Date(dueDate.getTime() - 15 * 60_000);
    expect(updatedFuture!.reminderAt!.getTime()).toBe(expected15Min.getTime());

    // Completed task should be unaffected (clearTestDB resets, but let's check)
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
    const assignee = await createTestUser({ email: "recalc-assignee@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      userId: owner._id,
      categoryId: category._id,
    });

    // Owner has 60 min, assignee has 15 min
    await NotificationPreference.create({
      userId: owner._id,
      enableInAppNotifications: true,
      reminderTimings: [60],
    });
    await NotificationPreference.create({
      userId: assignee._id,
      enableInAppNotifications: true,
      reminderTimings: [15],
    });

    const dueDate = new Date(Date.now() + 4 * 60 * 60_000);
    const task = await createTestTask({
      title: "Assigned task",
      userId: owner._id,
      projectId: project._id,
      assigneeId: assignee._id,
      dueDate,
      reminderAt: new Date(dueDate.getTime() - 60 * 60_000),
    });

    // Recalculate for assignee — should still merge both users' timings
    await recalculateRemindersForUser(assignee._id.toString());

    const updated = await Task.findById(task._id);
    expect(updated?.reminderAt).toBeDefined();

    // Merged timings: {60, 15} → soonest future is 60 min before
    const expected = new Date(dueDate.getTime() - 60 * 60_000);
    expect(updated!.reminderAt!.getTime()).toBe(expected.getTime());
  });
});
