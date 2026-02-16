import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers";
import { NotificationPreference } from "@/models/notification-preference";
import { Notification } from "@/models/notification";
import { Task } from "@/models/task";
import { POST } from "./route";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

describe("/api/notifications/check-due-dates", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  async function seedFixtures() {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      userId: user._id,
      categoryId: category._id,
    });

    return { user, category, project };
  }

  describe("POST", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await POST();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("creates reminder notifications for tasks with reminderAt due", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableDailySummary: false,
        quietHoursEnabled: false,
      });

      // Create a task with reminderAt in the past (due to fire)
      const reminderAt = new Date(Date.now() - 60_000); // 1 minute ago
      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task with reminder",
        reminderAt,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.reminders).toBe(1);

      const notifications = await Notification.find({ userId: user._id });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("reminder");
      expect(notifications[0].title).toBe("Task reminder");
    });

    it("clears reminderAt after creating reminder notification (one-shot)", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableDailySummary: false,
        quietHoursEnabled: false,
      });

      const reminderAt = new Date(Date.now() - 60_000);
      const task = await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task with reminder",
        reminderAt,
      });

      await POST();

      // Verify reminderAt was cleared
      const updatedTask = await Task.findById(task._id);
      expect(updatedTask?.reminderAt).toBeUndefined();
    });

    it("creates notifications for overdue tasks", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableOverdueSummary: true,
        enableDailySummary: false,
        quietHoursEnabled: false,
      });

      // Create an overdue task
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Overdue task",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.overdue).toBe(1);

      const notifications = await Notification.find({ userId: user._id });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("overdue");
    });

    it("does not create duplicate overdue notifications", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableOverdueSummary: true,
        enableDailySummary: false,
        quietHoursEnabled: false,
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      const task = await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Overdue task",
        dueDate,
      });

      // Create existing overdue notification
      await Notification.create({
        userId: user._id,
        taskId: task._id,
        type: "overdue",
        title: "Task is overdue",
        message: "Already notified",
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.overdue).toBe(0);

      const notifications = await Notification.find({ userId: user._id });
      expect(notifications).toHaveLength(1);
    });

    it("skips completed tasks", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableOverdueSummary: true,
        enableDailySummary: false,
        quietHoursEnabled: false,
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Completed overdue task",
        dueDate,
        completedAt: new Date(),
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(0);
    });

    it("respects quiet hours setting", async () => {
      const { user, project } = await seedFixtures();

      // Set quiet hours to cover the current UTC time
      const now = new Date();
      const currentUTCHour = now.getUTCHours();
      const quietStartHour = currentUTCHour === 0 ? 23 : currentUTCHour - 1;
      const quietEndHour = currentUTCHour === 23 ? 0 : currentUTCHour + 1;

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableOverdueSummary: true,
        enableDailySummary: false,
        quietHoursEnabled: true,
        quietHoursStart: `${quietStartHour.toString().padStart(2, "0")}:00`,
        quietHoursEnd: `${quietEndHour.toString().padStart(2, "0")}:00`,
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Overdue task",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.overdue).toBe(0);
    });

    it("does not create notifications when in-app notifications are disabled", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: false,
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Overdue task",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(0);
    });

    it("creates daily summary notification when there are due/overdue tasks", async () => {
      const { user, project } = await seedFixtures();

      // Set dailySummaryTime to 00:00 so it always triggers (current time is always >= 00:00)
      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableDailySummary: true,
        dailySummaryTime: "00:00",
        quietHoursEnabled: false,
      });

      // Create an overdue task
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Overdue task for summary",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.dailySummaries).toBe(1);

      const summaries = await Notification.find({
        userId: user._id,
        type: "daily-summary",
      });
      expect(summaries).toHaveLength(1);
      expect(summaries[0].title).toBe("Daily Summary");
      expect(summaries[0].taskId).toBeUndefined();
    });

    it("does not create daily summary when no due/overdue tasks", async () => {
      const { user } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableDailySummary: true,
        dailySummaryTime: "00:00",
        quietHoursEnabled: false,
      });

      // No tasks at all
      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.dailySummaries).toBe(0);
    });

    it("does not create duplicate daily summary", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableDailySummary: true,
        dailySummaryTime: "00:00",
        quietHoursEnabled: false,
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Overdue task",
        dueDate,
      });

      // Create existing daily summary from today (with summaryDate metadata for dedup)
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });
      await Notification.create({
        userId: user._id,
        type: "daily-summary",
        title: "Daily Summary",
        message: "Already sent today",
        metadata: { summaryDate: todayStr },
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.dailySummaries).toBe(0);
    });

    it("skips daily summary when enableDailySummary is false", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableDailySummary: false,
        dailySummaryTime: "00:00",
        quietHoursEnabled: false,
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Overdue task",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.dailySummaries).toBe(0);
    });
  });
});
