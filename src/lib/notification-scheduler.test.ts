import { describe, it, expect } from "vitest";
import {
  isWithinQuietHours,
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

  describe("generateNotificationsForTask", () => {
    const basePreferences: INotificationPreference = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      enableInAppNotifications: true,
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

    it("should not create duplicate overdue notifications", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-14T10:00:00.000Z"), // overdue
      } as ITask;

      const existingNotifications: Partial<INotification>[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          taskId,
          type: "overdue",
          title: "Task is overdue",
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
        dueDate: new Date("2026-02-14T10:00:00.000Z"), // overdue
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

    it("should not create notification for completed tasks", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-14T10:00:00.000Z"),
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

    it("should not create overdue notification when enableOverdueSummary is false", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-14T10:00:00.000Z"), // overdue
      } as ITask;

      const preferences = {
        ...basePreferences,
        enableOverdueSummary: false,
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

    it("should not create overdue notification for future tasks", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-16T10:00:00.000Z"), // 1 day in future
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

    it("should include priority in metadata", () => {
      const task = {
        ...baseTask,
        dueDate: new Date("2026-02-14T10:00:00.000Z"), // overdue
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
