import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { Notification, type INotification } from "./notification";
import { User } from "./user";
import { Project } from "./project";
import { Task } from "./task";
import { Category } from "./category";
import { setupTestDB, teardownTestDB } from "@/test/helpers/db";
import {
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers/factories";

describe("Notification Model", () => {
  let testUserId: mongoose.Types.ObjectId;
  let testTaskId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Notification.deleteMany({});
  });

  beforeEach(async () => {
    // Create test fixtures
    const user = await createTestUser();
    testUserId = user._id;

    const category = await createTestCategory({ userId: testUserId });

    const project = await createTestProject({
      userId: testUserId,
      categoryId: category._id,
    });

    const task = await createTestTask({
      projectId: project._id,
      userId: testUserId,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
    });
    testTaskId = task._id;
  });

  describe("Schema Validation", () => {
    it("should create a notification with required fields", async () => {
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Task due soon",
        message: "Your task is due in 1 hour",
      });

      expect(notification.userId.toString()).toBe(testUserId.toString());
      expect(notification.taskId.toString()).toBe(testTaskId.toString());
      expect(notification.type).toBe("due-soon");
      expect(notification.title).toBe("Task due soon");
      expect(notification.message).toBe("Your task is due in 1 hour");
      expect(notification.read).toBe(false);
      expect(notification.createdAt).toBeInstanceOf(Date);
      expect(notification.updatedAt).toBeInstanceOf(Date);
    });

    it("should require userId", async () => {
      await expect(
        Notification.create({
          taskId: testTaskId,
          type: "due-soon",
          title: "Task due soon",
          message: "Your task is due in 1 hour",
        }),
      ).rejects.toThrow();
    });

    it("should require taskId", async () => {
      await expect(
        Notification.create({
          userId: testUserId,
          type: "due-soon",
          title: "Task due soon",
          message: "Your task is due in 1 hour",
        }),
      ).rejects.toThrow();
    });

    it("should require type", async () => {
      await expect(
        Notification.create({
          userId: testUserId,
          taskId: testTaskId,
          title: "Task due soon",
          message: "Your task is due in 1 hour",
        }),
      ).rejects.toThrow();
    });

    it("should require title", async () => {
      await expect(
        Notification.create({
          userId: testUserId,
          taskId: testTaskId,
          type: "due-soon",
          message: "Your task is due in 1 hour",
        }),
      ).rejects.toThrow();
    });

    it("should require message", async () => {
      await expect(
        Notification.create({
          userId: testUserId,
          taskId: testTaskId,
          type: "due-soon",
          title: "Task due soon",
        }),
      ).rejects.toThrow();
    });

    it("should validate notification type enum", async () => {
      await expect(
        Notification.create({
          userId: testUserId,
          taskId: testTaskId,
          type: "invalid-type" as any,
          title: "Task due soon",
          message: "Your task is due in 1 hour",
        }),
      ).rejects.toThrow();
    });

    it("should accept valid notification types", async () => {
      const types: Array<INotification["type"]> = [
        "due-soon",
        "overdue",
        "reminder",
        "daily-summary",
      ];

      for (const type of types) {
        const notification = await Notification.create({
          userId: testUserId,
          taskId: testTaskId,
          type,
          title: `Test ${type}`,
          message: `Test message for ${type}`,
        });

        expect(notification.type).toBe(type);
      }
    });

    it("should enforce title maxlength", async () => {
      const longTitle = "a".repeat(201);

      await expect(
        Notification.create({
          userId: testUserId,
          taskId: testTaskId,
          type: "due-soon",
          title: longTitle,
          message: "Test message",
        }),
      ).rejects.toThrow();
    });

    it("should enforce message maxlength", async () => {
      const longMessage = "a".repeat(501);

      await expect(
        Notification.create({
          userId: testUserId,
          taskId: testTaskId,
          type: "due-soon",
          title: "Test title",
          message: longMessage,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Default Values", () => {
    it("should default read to false", async () => {
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
      });

      expect(notification.read).toBe(false);
    });

    it("should default dismissed to false", async () => {
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
      });

      expect(notification.dismissed).toBe(false);
    });
  });

  describe("Optional Fields", () => {
    it("should accept scheduledFor date", async () => {
      const scheduledDate = new Date(Date.now() + 60 * 60 * 1000);
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "reminder",
        title: "Reminder",
        message: "Test reminder",
        scheduledFor: scheduledDate,
      });

      expect(notification.scheduledFor).toBeInstanceOf(Date);
      expect(notification.scheduledFor?.getTime()).toBe(scheduledDate.getTime());
    });

    it("should accept snoozedUntil date", async () => {
      const snoozeDate = new Date(Date.now() + 30 * 60 * 1000);
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
        snoozedUntil: snoozeDate,
      });

      expect(notification.snoozedUntil).toBeInstanceOf(Date);
      expect(notification.snoozedUntil?.getTime()).toBe(snoozeDate.getTime());
    });

    it("should accept sentAt date", async () => {
      const sentDate = new Date();
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
        sentAt: sentDate,
      });

      expect(notification.sentAt).toBeInstanceOf(Date);
      expect(notification.sentAt?.getTime()).toBe(sentDate.getTime());
    });

    it("should accept metadata object", async () => {
      const metadata = {
        projectId: new mongoose.Types.ObjectId().toString(),
        projectName: "Test Project",
        taskTitle: "Test Task",
        priority: "high",
      };

      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
        metadata,
      });

      expect(notification.metadata).toEqual(metadata);
    });
  });

  describe("Indexing", () => {
    it("should have compound index on userId and read", async () => {
      const indexes = Notification.schema.indexes();
      const hasUserIdReadIndex = indexes.some(
        (idx) =>
          JSON.stringify(idx[0]) === JSON.stringify({ userId: 1, read: 1 }),
      );
      expect(hasUserIdReadIndex).toBe(true);
    });

    it("should have index on taskId", async () => {
      const indexes = Notification.schema.indexes();
      const hasTaskIdIndex = indexes.some(
        (idx) => JSON.stringify(idx[0]) === JSON.stringify({ taskId: 1 }),
      );
      expect(hasTaskIdIndex).toBe(true);
    });

    it("should have compound index on userId and scheduledFor", async () => {
      const indexes = Notification.schema.indexes();
      const hasScheduledIndex = indexes.some(
        (idx) =>
          JSON.stringify(idx[0]) ===
          JSON.stringify({ userId: 1, scheduledFor: 1 }),
      );
      expect(hasScheduledIndex).toBe(true);
    });
  });

  describe("Update Operations", () => {
    it("should mark notification as read", async () => {
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
      });

      expect(notification.read).toBe(false);

      const updated = await Notification.findByIdAndUpdate(
        notification._id,
        { read: true },
        { returnDocument: "after" },
      );

      expect(updated?.read).toBe(true);
    });

    it("should mark notification as dismissed", async () => {
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
      });

      expect(notification.dismissed).toBe(false);

      const updated = await Notification.findByIdAndUpdate(
        notification._id,
        { dismissed: true },
        { returnDocument: "after" },
      );

      expect(updated?.dismissed).toBe(true);
    });

    it("should update snoozedUntil", async () => {
      const notification = await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Test",
        message: "Test message",
      });

      const snoozeDate = new Date(Date.now() + 30 * 60 * 1000);
      const updated = await Notification.findByIdAndUpdate(
        notification._id,
        { snoozedUntil: snoozeDate },
        { returnDocument: "after" },
      );

      expect(updated?.snoozedUntil).toBeInstanceOf(Date);
      expect(updated?.snoozedUntil?.getTime()).toBe(snoozeDate.getTime());
    });
  });

  describe("Query Operations", () => {
    it("should find all notifications for a user", async () => {
      await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Notification 1",
        message: "Message 1",
      });

      await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "overdue",
        title: "Notification 2",
        message: "Message 2",
      });

      const notifications = await Notification.find({ userId: testUserId });
      expect(notifications).toHaveLength(2);
    });

    it("should find unread notifications for a user", async () => {
      await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "Unread",
        message: "Message",
        read: false,
      });

      await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "overdue",
        title: "Read",
        message: "Message",
        read: true,
      });

      const unread = await Notification.find({
        userId: testUserId,
        read: false,
      });
      expect(unread).toHaveLength(1);
      expect(unread[0].title).toBe("Unread");
    });

    it("should find notifications by task", async () => {
      const project = await Project.findOne({ userId: testUserId });
      if (!project) throw new Error("Project not found");

      const anotherTask = await createTestTask({
        projectId: project._id,
        userId: testUserId,
      });

      await Notification.create({
        userId: testUserId,
        taskId: testTaskId,
        type: "due-soon",
        title: "For task 1",
        message: "Message",
      });

      await Notification.create({
        userId: testUserId,
        taskId: anotherTask._id,
        type: "due-soon",
        title: "For task 2",
        message: "Message",
      });

      const notifications = await Notification.find({ taskId: testTaskId });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe("For task 1");
    });
  });

});
