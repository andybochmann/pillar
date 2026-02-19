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
  processOverdueDigest,
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

    const created = await Notification.find({
      userId: user._id,
      type: "overdue",
    });
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

describe("processOverdueDigest", () => {
  async function createUserWithPrefs(overrides: Record<string, unknown> = {}) {
    const user = await createTestUser();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });
    await NotificationPreference.create({
      userId: user._id,
      enableInAppNotifications: true,
      enableBrowserPush: false,
      enableOverdueSummary: true,
      overdueSummaryTime: "09:00",
      enableDailySummary: false,
      timezone: "UTC",
      quietHoursEnabled: false,
      ...overrides,
    });
    return { user, category, project };
  }

  it("sends overdue digest at configured time with task previews", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "08:00",
    });

    // Create overdue tasks (due yesterday and 3 days ago)
    await createTestTask({
      title: "Overdue task A",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000), // 1 day ago
    });
    await createTestTask({
      title: "Overdue task B",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60_000), // 3 days ago
    });

    // "Now" is 10:00 UTC — past the 08:00 configured time
    const now = new Date();
    now.setUTCHours(10, 0, 0, 0);

    const count = await processOverdueDigest(now, user._id.toString());
    expect(count).toBe(1);

    const notifications = await Notification.find({
      userId: user._id,
      type: "overdue-digest",
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Overdue Tasks Summary");
    expect(notifications[0].message).toContain("2 overdue tasks");
    expect(notifications[0].message).toContain("Overdue task A");
    expect(notifications[0].message).toContain("Overdue task B");

    const metadata = notifications[0].metadata as Record<string, unknown>;
    expect(metadata.overdueCount).toBe(2);
    expect(metadata.overdueSummaryDate).toBeDefined();
    const tasks = metadata.tasks as Array<Record<string, unknown>>;
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toHaveProperty("daysOverdue");
  });

  it("skips if current time is before configured overdue summary time", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "14:00",
    });

    await createTestTask({
      title: "Overdue task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000),
    });

    // "Now" is 08:00 UTC — before the 14:00 configured time
    const now = new Date();
    now.setUTCHours(8, 0, 0, 0);

    const count = await processOverdueDigest(now, user._id.toString());
    expect(count).toBe(0);

    const notifications = await Notification.find({
      userId: user._id,
      type: "overdue-digest",
    });
    expect(notifications).toHaveLength(0);
  });

  it("deduplicates — does not send twice for the same date", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "08:00",
    });

    await createTestTask({
      title: "Overdue task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000),
    });

    const now = new Date();
    now.setUTCHours(10, 0, 0, 0);

    // First call — should create notification
    const count1 = await processOverdueDigest(now, user._id.toString());
    expect(count1).toBe(1);

    // Second call same day — should be deduplicated
    const count2 = await processOverdueDigest(now, user._id.toString());
    expect(count2).toBe(0);

    const notifications = await Notification.find({
      userId: user._id,
      type: "overdue-digest",
    });
    expect(notifications).toHaveLength(1);
  });

  it("skips users with enableOverdueSummary disabled", async () => {
    const { user, project } = await createUserWithPrefs({
      enableOverdueSummary: false,
      overdueSummaryTime: "08:00",
    });

    await createTestTask({
      title: "Overdue task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000),
    });

    const now = new Date();
    now.setUTCHours(10, 0, 0, 0);

    const count = await processOverdueDigest(now, user._id.toString());
    expect(count).toBe(0);
  });

  it("does not send when there are no overdue tasks", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "08:00",
    });

    // Task due tomorrow — not overdue
    await createTestTask({
      title: "Future task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() + 24 * 60 * 60_000),
    });

    const now = new Date();
    now.setUTCHours(10, 0, 0, 0);

    const count = await processOverdueDigest(now, user._id.toString());
    expect(count).toBe(0);
  });

  it("respects quiet hours", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "23:00",
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    });

    await createTestTask({
      title: "Overdue task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000),
    });

    const now = new Date();
    now.setUTCHours(23, 30, 0, 0);

    const count = await processOverdueDigest(now, user._id.toString());
    expect(count).toBe(0);
  });

  it("limits task previews to 10", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "08:00",
    });

    // Create 12 overdue tasks
    for (let i = 0; i < 12; i++) {
      await createTestTask({
        title: `Overdue task ${i + 1}`,
        userId: user._id,
        projectId: project._id,
        dueDate: new Date(Date.now() - (i + 1) * 24 * 60 * 60_000),
      });
    }

    const now = new Date();
    now.setUTCHours(10, 0, 0, 0);

    const count = await processOverdueDigest(now, user._id.toString());
    expect(count).toBe(1);

    const notifications = await Notification.find({
      userId: user._id,
      type: "overdue-digest",
    });
    const metadata = notifications[0].metadata as Record<string, unknown>;
    expect(metadata.overdueCount).toBe(12);
    const tasks = metadata.tasks as Array<Record<string, unknown>>;
    expect(tasks).toHaveLength(10);
    // Message should mention the remaining tasks
    expect(notifications[0].message).toContain("and 7 more");
  });

  it("sends push notification when browser push is enabled", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "08:00",
      enableBrowserPush: true,
    });

    await createTestTask({
      title: "Overdue task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000),
    });

    const now = new Date();
    now.setUTCHours(10, 0, 0, 0);

    await processOverdueDigest(now, user._id.toString());

    expect(pushPayloads).toHaveLength(1);
    expect(pushPayloads[0].payload.title).toBe("Overdue Tasks Summary");
    expect(pushPayloads[0].payload.url).toBe("/");
  });

  it("is called by processNotifications and returns count", async () => {
    const { user, project } = await createUserWithPrefs({
      overdueSummaryTime: "00:00",
      enableDailySummary: false,
    });

    await createTestTask({
      title: "Overdue task",
      userId: user._id,
      projectId: project._id,
      dueDate: new Date(Date.now() - 24 * 60 * 60_000),
    });

    const result = await processNotifications(user._id.toString());
    expect(result.overdueDigests).toBe(1);
  });
});
