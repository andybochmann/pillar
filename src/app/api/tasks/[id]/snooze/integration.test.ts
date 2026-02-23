/**
 * Integration test: verifies the full notification-worker → snooze/complete flow
 * using real MongoDB operations (no mocks except auth and external services).
 *
 * This tests the exact scenario reported as broken:
 * 1. Task has reminderAt in the past
 * 2. Notification worker fires → creates notification, clears reminderAt
 * 3. User clicks "Snooze" → snooze endpoint sets reminderAt to now + 24h
 * 4. Verify task has reminderAt set (not cleared)
 *
 * Similarly for complete:
 * 1. Task exists in "todo" column
 * 2. User clicks "Mark Complete" → complete endpoint sets completedAt + moves to done
 * 3. Verify task is completed and in done column
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
  createTestProjectMember,
} from "@/test/helpers";
import { Task } from "@/models/task";
import { Notification } from "@/models/notification";
import { NotificationPreference } from "@/models/notification-preference";

// Track push payloads
const pushPayloads: { userId: string; payload: Record<string, unknown> }[] = [];

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/web-push", () => ({
  sendPushToUser: vi.fn((userId: string, payload: Record<string, unknown>) => {
    pushPayloads.push({ userId, payload });
    return Promise.resolve(1);
  }),
}));

vi.mock("@/lib/event-bus", () => ({
  emitNotificationEvent: vi.fn(),
  emitSyncEvent: vi.fn(),
}));

// Import handlers AFTER mocks
import { POST as snoozeHandler } from "./route";
import { POST as completeHandler } from "../complete/route";
import { processNotifications } from "@/lib/notification-worker";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await clearTestDB();
  pushPayloads.length = 0;
});

describe("notification → snooze integration", () => {
  it("snooze restores reminderAt after notification worker clears it", async () => {
    // Setup
    const user = await createTestUser({ email: "int-snooze@example.com" });
    const userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
    });
    const projectId = project._id as mongoose.Types.ObjectId;
    await createTestProjectMember({ projectId, userId, role: "owner", invitedBy: userId });

    // Create a task with reminderAt in the past (triggers notification worker)
    const task = await createTestTask({
      projectId,
      userId,
      title: "Task with reminder",
      reminderAt: new Date(Date.now() - 60_000), // 1 min ago
    });

    await NotificationPreference.create({
      userId,
      enableInAppNotifications: true,
      enableBrowserPush: true,
      quietHoursEnabled: false,
    });

    // Step 1: Verify task has reminderAt set
    const taskBefore = await Task.findById(task._id);
    expect(taskBefore!.reminderAt).toBeDefined();

    // Step 2: Notification worker fires — creates notification, clears reminderAt
    await processNotifications(userId.toString());

    // Verify: notification was created
    const notifications = await Notification.find({ userId, type: "reminder" });
    expect(notifications).toHaveLength(1);

    // Verify: push was sent with taskId and actions
    expect(pushPayloads).toHaveLength(1);
    const pushPayload = pushPayloads[0].payload;
    expect(pushPayload.taskId).toBe(task._id.toString());
    expect(pushPayload.actions).toBeDefined();
    expect(pushPayload.notificationType).toBe("reminder");

    // Verify: reminderAt was cleared by the worker
    const taskAfterWorker = await Task.findById(task._id);
    expect(taskAfterWorker!.reminderAt).toBeUndefined();

    // Step 3: User clicks "Snooze 1 Day" — SW calls snooze endpoint
    // This simulates exactly what the service worker does
    const notificationId = notifications[0]._id.toString();
    const snoozeRequest = new Request(
      `http://localhost:3000/api/tasks/${task._id.toString()}/snooze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      },
    );

    const snoozeRes = await snoozeHandler(snoozeRequest, {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(snoozeRes.status).toBe(200);

    const snoozeData = await snoozeRes.json();
    expect(snoozeData.success).toBe(true);
    expect(snoozeData.snoozedUntil).toBeDefined();

    // Step 4: Verify task now has reminderAt set to ~24h from now
    const taskAfterSnooze = await Task.findById(task._id);
    expect(taskAfterSnooze!.reminderAt).toBeDefined();
    expect(taskAfterSnooze!.reminderAt).not.toBeNull();

    const reminderTime = taskAfterSnooze!.reminderAt!.getTime();
    const expectedMin = Date.now() + 23 * 60 * 60 * 1000; // 23h (buffer)
    const expectedMax = Date.now() + 25 * 60 * 60 * 1000; // 25h (buffer)
    expect(reminderTime).toBeGreaterThan(expectedMin);
    expect(reminderTime).toBeLessThan(expectedMax);

    // Step 5: Verify notification was marked as read
    const updatedNotification = await Notification.findById(notifications[0]._id);
    expect(updatedNotification!.read).toBe(true);
    expect(updatedNotification!.snoozedUntil).toBeDefined();
  });

  it("snooze works even when notification worker already scheduled next reminder", async () => {
    // This tests the race condition: notification worker clears reminderAt,
    // scheduleNextReminder sets a new one, then user snoozes → snooze should win
    const user = await createTestUser({ email: "int-race@example.com" });
    const userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
    });
    const projectId = project._id as mongoose.Types.ObjectId;
    await createTestProjectMember({ projectId, userId, role: "owner", invitedBy: userId });

    // Create task with dueDate (allows scheduleNextReminder to work)
    const task = await createTestTask({
      projectId,
      userId,
      title: "Task with due date",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60_000), // 1 week from now
      reminderAt: new Date(Date.now() - 60_000), // 1 min ago (triggers worker)
    });

    await NotificationPreference.create({
      userId,
      enableInAppNotifications: true,
      enableBrowserPush: true,
      quietHoursEnabled: false,
      dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
    });

    // Run notification worker
    await processNotifications(userId.toString());

    // Wait a bit for scheduleNextReminder to complete (fire-and-forget in worker)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Task might have a new reminderAt from scheduleNextReminder
    const taskAfterWorker = await Task.findById(task._id);
    // Either undefined (no valid future time) or a scheduled time — either way, snooze should override

    // User snoozes
    const beforeSnooze = Date.now();
    const snoozeRequest = new Request(
      `http://localhost:3000/api/tasks/${task._id.toString()}/snooze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const snoozeRes = await snoozeHandler(snoozeRequest, {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(snoozeRes.status).toBe(200);

    // Verify: reminderAt is ~24h from now (snooze wins over any scheduled reminder)
    const taskAfterSnooze = await Task.findById(task._id);
    expect(taskAfterSnooze!.reminderAt).toBeDefined();

    const reminderTime = taskAfterSnooze!.reminderAt!.getTime();
    const expected24h = beforeSnooze + 24 * 60 * 60 * 1000;
    expect(Math.abs(reminderTime - expected24h)).toBeLessThan(5000); // within 5s
  });
});

describe("notification → complete integration", () => {
  it("complete marks task done and moves to done column", async () => {
    const user = await createTestUser({ email: "int-complete@example.com" });
    const userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
      columns: [
        { id: "todo", name: "To Do", order: 0 },
        { id: "in-progress", name: "In Progress", order: 1 },
        { id: "done", name: "Done", order: 2 },
      ],
    });
    const projectId = project._id as mongoose.Types.ObjectId;
    await createTestProjectMember({ projectId, userId, role: "owner", invitedBy: userId });

    // Create task with reminder that triggers notification
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      title: "Complete from notification",
      reminderAt: new Date(Date.now() - 60_000),
    });

    await NotificationPreference.create({
      userId,
      enableInAppNotifications: true,
      enableBrowserPush: true,
      quietHoursEnabled: false,
    });

    // Notification worker fires
    await processNotifications(userId.toString());

    // Verify push was sent with the task's ID
    expect(pushPayloads).toHaveLength(1);
    const pushTaskId = pushPayloads[0].payload.taskId as string;
    expect(pushTaskId).toBe(task._id.toString());

    // User clicks "Mark Complete" — SW calls complete endpoint
    const completeRequest = new Request(
      `http://localhost:3000/api/tasks/${pushTaskId}/complete`,
      { method: "POST" },
    );

    const completeRes = await completeHandler(completeRequest, {
      params: Promise.resolve({ id: pushTaskId }),
    });
    expect(completeRes.status).toBe(200);

    const data = await completeRes.json();
    expect(data.completedAt).toBeDefined();
    expect(data.columnId).toBe("done");

    // Verify DB state
    const dbTask = await Task.findById(task._id);
    expect(dbTask!.completedAt).toBeDefined();
    expect(dbTask!.columnId).toBe("done");
    expect(dbTask!.statusHistory).toHaveLength(1);
    expect(dbTask!.statusHistory[0].columnId).toBe("done");
  });

  it("complete uses the actual taskId from the push payload", async () => {
    // Verifies the data flow: worker → push payload → taskId → API
    const user = await createTestUser({ email: "int-payload@example.com" });
    const userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
      columns: [
        { id: "todo", name: "To Do", order: 0 },
        { id: "done", name: "Done", order: 1 },
      ],
    });
    const projectId = project._id as mongoose.Types.ObjectId;
    await createTestProjectMember({ projectId, userId, role: "owner", invitedBy: userId });

    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      title: "Payload flow test",
      reminderAt: new Date(Date.now() - 60_000),
    });

    await NotificationPreference.create({
      userId,
      enableInAppNotifications: true,
      enableBrowserPush: true,
      quietHoursEnabled: false,
    });

    await processNotifications(userId.toString());

    // Extract the taskId from the push payload — this is what the SW would use
    const payloadTaskId = pushPayloads[0].payload.taskId as string;
    const payloadNotificationId = pushPayloads[0].payload.notificationId as string;

    // Verify the IDs match what we created
    expect(payloadTaskId).toBe(task._id.toString());
    expect(payloadNotificationId).toBeDefined();

    // Simulate SW's fetch URL construction
    const url = `/api/tasks/${payloadTaskId}/complete`;
    expect(url).toBe(`/api/tasks/${task._id.toString()}/complete`);

    // Call the endpoint with the payload's taskId
    const req = new Request(`http://localhost:3000${url}`, { method: "POST" });
    const res = await completeHandler(req, {
      params: Promise.resolve({ id: payloadTaskId }),
    });

    expect(res.status).toBe(200);

    const dbTask = await Task.findById(payloadTaskId);
    expect(dbTask!.completedAt).toBeDefined();
    expect(dbTask!.columnId).toBe("done");
  });
});
