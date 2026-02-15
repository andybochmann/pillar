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

    it("creates notifications for tasks with upcoming due dates", async () => {
      const { user, project } = await seedFixtures();

      // Create notification preferences
      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        reminderTimings: [60], // 1 hour before
        quietHoursEnabled: false,
      });

      // Create a task due in 1 hour
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task due soon",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(1);

      const notifications = await Notification.find({ userId: user._id });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("reminder");
      expect(notifications[0].title).toContain("Task due in");
    });

    it("creates notifications for overdue tasks", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        enableOverdueSummary: true,
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
      expect(body.notificationsCreated).toBe(1);

      const notifications = await Notification.find({ userId: user._id });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("overdue");
    });

    it("does not create duplicate notifications", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        reminderTimings: [60],
        quietHoursEnabled: false,
      });

      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 1);

      const task = await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task due soon",
        dueDate,
      });

      // Create existing notification
      await Notification.create({
        userId: user._id,
        taskId: task._id,
        type: "reminder",
        title: "Task due in 1 hour",
        message: "Task is due soon",
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(0);

      const notifications = await Notification.find({ userId: user._id });
      expect(notifications).toHaveLength(1);
    });

    it("skips tasks without due dates", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        reminderTimings: [60],
      });

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task without due date",
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(0);
    });

    it("skips completed tasks", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        reminderTimings: [60],
      });

      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Completed task",
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
        reminderTimings: [60],
        quietHoursEnabled: true,
        quietHoursStart: `${quietStartHour.toString().padStart(2, "0")}:00`,
        quietHoursEnd: `${quietEndHour.toString().padStart(2, "0")}:00`,
      });

      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task due soon",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(0);
    });

    it("creates default preferences if none exist", async () => {
      const { user, project } = await seedFixtures();

      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task due soon",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(1);

      // Check that preferences were created
      const prefs = await NotificationPreference.findOne({ userId: user._id });
      expect(prefs).toBeTruthy();
      expect(prefs?.enableInAppNotifications).toBe(true);
    });

    it("handles multiple tasks with different due dates", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: true,
        reminderTimings: [60, 1440], // 1 hour and 1 day
        enableOverdueSummary: true,
        quietHoursEnabled: false,
      });

      // Task due in 1 hour
      const dueDate1 = new Date();
      dueDate1.setHours(dueDate1.getHours() + 1);
      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task 1",
        dueDate: dueDate1,
      });

      // Task due in 1 day
      const dueDate2 = new Date();
      dueDate2.setDate(dueDate2.getDate() + 1);
      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task 2",
        dueDate: dueDate2,
      });

      // Overdue task
      const dueDate3 = new Date();
      dueDate3.setDate(dueDate3.getDate() - 1);
      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task 3",
        dueDate: dueDate3,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBeGreaterThanOrEqual(3);
    });

    it("does not create notifications when in-app notifications are disabled", async () => {
      const { user, project } = await seedFixtures();

      await NotificationPreference.create({
        userId: user._id,
        enableInAppNotifications: false,
        reminderTimings: [60],
      });

      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 1);

      await createTestTask({
        userId: user._id,
        projectId: project._id,
        title: "Task due soon",
        dueDate,
      });

      const res = await POST();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notificationsCreated).toBe(0);
    });
  });
});
