import { describe, it, expect } from "vitest";
import {
  shouldCreateNotification,
  isWithinQuietHours,
  calculateNotificationTime,
  generateNotificationsForTask,
  type NotificationToCreate,
} from "./notification-scheduler";
import type { ITask } from "@/models/task";
import type { INotificationPreference } from "@/models/notification-preference";
import type { INotification } from "@/models/notification";
import mongoose from "mongoose";

describe("notification-scheduler", () => {
  const now = new Date("2026-02-15T10:00:00.000Z");
  const userId = new mongoose.Types.ObjectId();
  const taskId = new mongoose.Types.ObjectId();
  const projectId = new mongoose.Types.ObjectId();

  describe("isWithinQuietHours", () => {
    it("should return false when quiet hours are disabled", () => {
      const result = isWithinQuietHours(
        now,
        false,
        "22:00",
        "08:00",
        "America/New_York",
      );
      expect(result).toBe(false);
    });

    it("should return true when time is within quiet hours (same day)", () => {
      const time = new Date("2026-02-15T23:00:00.000Z"); // 11 PM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "22:00",
        "08:00",
        "UTC",
      );
      expect(result).toBe(true);
    });

    it("should return false when time is outside quiet hours", () => {
      const time = new Date("2026-02-15T15:00:00.000Z"); // 3 PM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "22:00",
        "08:00",
        "UTC",
      );
      expect(result).toBe(false);
    });

    it("should handle quiet hours spanning midnight", () => {
      const time = new Date("2026-02-15T02:00:00.000Z"); // 2 AM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "22:00",
        "08:00",
        "UTC",
      );
      expect(result).toBe(true);
    });

    it("should handle quiet hours not spanning midnight", () => {
      const time = new Date("2026-02-15T14:00:00.000Z"); // 2 PM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "12:00",
        "18:00",
        "UTC",
      );
      expect(result).toBe(true);
    });
  });

  describe("calculateNotificationTime", () => {
    it("should calculate notification time for minutes before due date", () => {
      const dueDate = new Date("2026-02-16T10:00:00.000Z");
      const result = calculateNotificationTime(dueDate, 60); // 1 hour before
      expect(result).toEqual(new Date("2026-02-16T09:00:00.000Z"));
    });

    it("should calculate notification time for 1 day before", () => {
      const dueDate = new Date("2026-02-16T10:00:00.000Z");
      const result = calculateNotificationTime(dueDate, 1440); // 1 day before
      expect(result).toEqual(new Date("2026-02-15T10:00:00.000Z"));
    });

    it("should calculate notification time for 15 minutes before", () => {
      const dueDate = new Date("2026-02-15T10:15:00.000Z");
      const result = calculateNotificationTime(dueDate, 15);
      expect(result).toEqual(new Date("2026-02-15T10:00:00.000Z"));
    });
  });

  describe("shouldCreateNotification", () => {
    it("should return true when notification time has passed and is recent", () => {
      const notificationTime = new Date("2026-02-15T09:00:00.000Z");
      const currentTime = new Date("2026-02-15T09:30:00.000Z");
      const result = shouldCreateNotification(notificationTime, currentTime);
      expect(result).toBe(true);
    });

    it("should return false when notification time is in the future", () => {
      const notificationTime = new Date("2026-02-15T11:00:00.000Z");
      const currentTime = new Date("2026-02-15T10:00:00.000Z");
      const result = shouldCreateNotification(notificationTime, currentTime);
      expect(result).toBe(false);
    });

    it("should return false when notification time is too far in the past", () => {
      const notificationTime = new Date("2026-02-14T09:00:00.000Z");
      const currentTime = new Date("2026-02-15T10:00:00.000Z");
      const result = shouldCreateNotification(notificationTime, currentTime);
      expect(result).toBe(false);
    });

    it("should return true when notification time is exactly at current time", () => {
      const notificationTime = new Date("2026-02-15T10:00:00.000Z");
      const currentTime = new Date("2026-02-15T10:00:00.000Z");
      const result = shouldCreateNotification(notificationTime, currentTime);
      expect(result).toBe(true);
    });

    it("should use 2-hour window by default", () => {
      const notificationTime = new Date("2026-02-15T08:00:00.000Z");
      const currentTime = new Date("2026-02-15T09:59:00.000Z"); // 1h 59m later
      const result = shouldCreateNotification(notificationTime, currentTime);
      expect(result).toBe(true);
    });
  });

  describe("generateNotificationsForTask", () => {
    const basePreferences: INotificationPreference = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      enableBrowserPush: true,
      enableInAppNotifications: true,
      reminderTimings: [1440, 60, 15], // 1 day, 1 hour, 15 min
      enableEmailDigest: false,
      emailDigestFrequency: "none",
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      enableOverdueSummary: true,
      createdAt: now,
      updatedAt: now,
    } as INotificationPreference;

    const baseTask: Partial<ITask> = {
      _id: taskId,
      title: "Test Task",
      description: "Test description",
      projectId,
      userId,
      columnId: "todo",
      priority: "medium",
      order: 0,
      labels: [],
      subtasks: [],
      timeSessions: [],
      statusHistory: [],
      recurrence: { frequency: "none", interval: 1 },
      createdAt: now,
      updatedAt: now,
    };

    it("should return empty array when in-app notifications are disabled", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-16T10:00:00.000Z"),
      } as ITask;

      const preferences = {
        ...basePreferences,
        enableInAppNotifications: false,
      };

      const result = generateNotificationsForTask(
        task,
        preferences,
        [],
        now,
        "UTC",
      );
      expect(result).toEqual([]);
    });

    it("should return empty array when task has no due date", () => {
      const task = { ...baseTask } as ITask;
      const result = generateNotificationsForTask(
        task,
        basePreferences,
        [],
        now,
        "UTC",
      );
      expect(result).toEqual([]);
    });

    it("should create reminder notification when due in 1 hour", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-15T11:00:00.000Z"), // 1 hour from now
      } as ITask;

      const result = generateNotificationsForTask(
        task,
        basePreferences,
        [],
        now,
        "UTC",
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "reminder",
        title: "Task due in 1 hour",
        taskId: taskId.toString(),
        userId: userId.toString(),
        scheduledFor: new Date("2026-02-15T10:00:00.000Z"),
      });
      expect(result[0].message).toContain("Test Task");
    });

    it("should create reminder notification when due in 1 day", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-16T10:00:00.000Z"), // 1 day from now
      } as ITask;

      const result = generateNotificationsForTask(
        task,
        basePreferences,
        [],
        now,
        "UTC",
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "reminder",
        title: "Task due in 1 day",
        taskId: taskId.toString(),
        userId: userId.toString(),
        scheduledFor: new Date("2026-02-15T10:00:00.000Z"),
      });
    });

    it("should create overdue notification when task is overdue", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-14T10:00:00.000Z"), // 1 day ago
      } as ITask;

      const result = generateNotificationsForTask(
        task,
        basePreferences,
        [],
        now,
        "UTC",
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "overdue",
        title: "Task is overdue",
        taskId: taskId.toString(),
        userId: userId.toString(),
      });
      expect(result[0].message).toContain("Test Task");
      expect(result[0].message).toContain("overdue");
    });

    it("should not create duplicate notifications", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-15T11:00:00.000Z"), // 1 hour from now
      } as ITask;

      const existingNotifications: Partial<INotification>[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          taskId,
          type: "reminder",
          title: "Task due in 1 hour",
          message: "Test",
          read: false,
          dismissed: false,
          createdAt: now,
          updatedAt: now,
        } as INotification,
      ];

      const result = generateNotificationsForTask(
        task,
        basePreferences,
        existingNotifications as INotification[],
        now,
        "UTC",
      );

      expect(result).toEqual([]);
    });

    it("should skip notifications during quiet hours", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-15T11:00:00.000Z"), // 1 hour from now
      } as ITask;

      const preferences = {
        ...basePreferences,
        quietHoursEnabled: true,
        quietHoursStart: "09:00",
        quietHoursEnd: "11:00",
      };

      const result = generateNotificationsForTask(
        task,
        preferences,
        [],
        now,
        "UTC",
      );

      expect(result).toEqual([]);
    });

    it("should create multiple reminder notifications for different timings", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-17T10:00:00.000Z"), // 2 days from now
      } as ITask;

      const currentTime = new Date("2026-02-16T10:00:00.000Z"); // 1 day before due

      const result = generateNotificationsForTask(
        task,
        basePreferences,
        [],
        currentTime,
        "UTC",
      );

      // Should create 1-day reminder
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Task due in 1 day");
    });

    it("should not create notification for completed tasks", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-15T11:00:00.000Z"),
        completedAt: new Date("2026-02-14T10:00:00.000Z"),
      } as ITask;

      const result = generateNotificationsForTask(
        task,
        basePreferences,
        [],
        now,
        "UTC",
      );

      expect(result).toEqual([]);
    });

    it("should use custom reminder timings from preferences", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-15T12:00:00.000Z"), // 2 hours from now
      } as ITask;

      const preferences = {
        ...basePreferences,
        reminderTimings: [120], // 2 hours before
      };

      const result = generateNotificationsForTask(
        task,
        preferences,
        [],
        now,
        "UTC",
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "reminder",
        title: "Task due in 2 hours",
      });
    });

    it("should handle reminder notification with custom timing", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-15T20:00:00.000Z"), // 10 hours from now
      } as ITask;

      const preferences = {
        ...basePreferences,
        reminderTimings: [600], // 10 hours before
      };

      const result = generateNotificationsForTask(
        task,
        preferences,
        [],
        now,
        "UTC",
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("reminder");
      expect(result[0].title).toBe("Task due in 10 hours");
    });

    it("should include priority in metadata", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-15T11:00:00.000Z"),
        priority: "urgent",
      } as ITask;

      const result = generateNotificationsForTask(
        task,
        basePreferences,
        [],
        now,
        "UTC",
      );

      expect(result[0].metadata).toEqual({
        priority: "urgent",
        dueDate: task.dueDate.toISOString(),
        projectId: projectId.toString(),
      });
    });
  });
});
