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
import { Notification } from "@/models/notification";

// Track push payloads sent via sendPushToUser
const pushPayloads: { userId: string; payload: Record<string, unknown> }[] = [];

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/web-push", () => ({
  sendPushToUser: vi.fn((userId: string, payload: Record<string, unknown>) => {
    pushPayloads.push({ userId, payload });
    return Promise.resolve(1);
  }),
}));

vi.mock("@/lib/event-bus", () => ({
  emitNotificationEvent: vi.fn(),
}));

import {
  processNotifications,
  processDailySummary,
} from "./notification-worker";

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

describe("notification-worker push URL", () => {
  it("includes project URL in push payload for reminder notifications", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });
    const projectId = project._id.toString();

    await createTestTask({
      title: "Reminder task",
      userId: user._id,
      projectId: project._id,
      reminderAt: new Date(Date.now() - 60_000), // 1 min ago
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      enableBrowserPush: true,
      quietHoursEnabled: false,
    });

    await processNotifications(user._id.toString());

    expect(pushPayloads).toHaveLength(1);
    expect(pushPayloads[0].payload.url).toBe(`/projects/${projectId}`);
  });

  it("includes project URL in push payload for overdue notifications", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });
    const projectId = project._id.toString();

    await createTestTask({
      title: "Overdue task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000), // yesterday
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      enableBrowserPush: true,
      enableOverdueSummary: true,
      enableDailySummary: false,
      quietHoursEnabled: false,
    });

    await processNotifications(user._id.toString());

    expect(pushPayloads).toHaveLength(1);
    expect(pushPayloads[0].payload.url).toBe(`/projects/${projectId}`);
  });

  it("uses '/' as URL for daily summary notifications (no single project)", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    await createTestTask({
      title: "Due today task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(), // today
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      enableBrowserPush: true,
      enableDailySummary: true,
      dailySummaryTime: "00:00",
      timezone: "UTC",
      quietHoursEnabled: false,
    });

    await processDailySummary(new Date(), user._id.toString());

    expect(pushPayloads).toHaveLength(1);
    expect(pushPayloads[0].payload.url).toBe("/");
  });
});

describe("notification-worker missing preferences", () => {
  it("creates reminder notifications with defaults when no preference record exists", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    await createTestTask({
      title: "Reminder without prefs",
      userId: user._id,
      projectId: project._id,
      reminderAt: new Date(Date.now() - 60_000), // 1 min ago
    });

    // Deliberately NO NotificationPreference created

    await processNotifications(user._id.toString());

    const created = await Notification.find({ userId: user._id });
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("reminder");
    // Push should NOT be sent (enableBrowserPush defaults to false)
    expect(pushPayloads).toHaveLength(0);
  });

  it("creates overdue notifications with defaults when no preference record exists", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    await createTestTask({
      title: "Overdue without prefs",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000), // yesterday
    });

    // Deliberately NO NotificationPreference created

    await processNotifications(user._id.toString());

    const created = await Notification.find({ userId: user._id, type: "overdue" });
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("overdue");
  });

  it("auto-creates preference record when processing user with missing prefs", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    await createTestTask({
      title: "Task triggers pref creation",
      userId: user._id,
      projectId: project._id,
      reminderAt: new Date(Date.now() - 60_000),
    });

    // No prefs record initially
    const before = await NotificationPreference.findOne({ userId: user._id });
    expect(before).toBeNull();

    await processNotifications(user._id.toString());

    // Prefs record should now exist with defaults
    const after = await NotificationPreference.findOne({ userId: user._id });
    expect(after).not.toBeNull();
    expect(after!.enableInAppNotifications).toBe(true);
    expect(after!.enableBrowserPush).toBe(false);
  });
});

describe("notification-worker preference gating", () => {
  it("creates reminder notifications when in-app is disabled but browser push is enabled", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    await createTestTask({
      title: "Reminder via push",
      userId: user._id,
      projectId: project._id,
      reminderAt: new Date(Date.now() - 60_000),
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: false,
      enableBrowserPush: true,
      quietHoursEnabled: false,
    });

    await processNotifications(user._id.toString());

    const created = await Notification.find({ userId: user._id });
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("reminder");
    expect(pushPayloads).toHaveLength(1);
  });

  it("sends daily summaries when in-app is disabled but browser push is enabled", async () => {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    await createTestTask({
      title: "Due today",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(),
    });

    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: false,
      enableBrowserPush: true,
      enableDailySummary: true,
      dailySummaryTime: "00:00",
      timezone: "UTC",
      quietHoursEnabled: false,
    });

    await processDailySummary(new Date(), user._id.toString());

    const created = await Notification.find({
      userId: user._id,
      type: "daily-summary",
    });
    expect(created).toHaveLength(1);
    expect(pushPayloads).toHaveLength(1);
  });
});
