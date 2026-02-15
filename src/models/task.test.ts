import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestLabel,
} from "@/test/helpers";
import { Task } from "@/models/task";

describe("Task Model", () => {
  let userId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    const user = await createTestUser();
    userId = user._id;
    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      userId,
      categoryId: category._id,
    });
    projectId = project._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Task.deleteMany({});
  });

  it("creates a task with valid fields", async () => {
    const dueDate = new Date("2026-03-01");
    const label1 = await createTestLabel({ userId, name: "bug" });
    const label2 = await createTestLabel({ userId, name: "auth" });
    const task = await Task.create({
      title: "Fix bug",
      description: "Fix the login bug",
      projectId,
      userId,
      columnId: "todo",
      priority: "high",
      dueDate,
      order: 0,
      labels: [label1._id, label2._id],
    });

    expect(task.title).toBe("Fix bug");
    expect(task.description).toBe("Fix the login bug");
    expect(task.priority).toBe("high");
    expect(task.dueDate).toEqual(dueDate);
    expect(task.columnId).toBe("todo");
    expect(task.order).toBe(0);
    expect(task.labels).toHaveLength(2);
    expect(task.labels[0].toString()).toBe(label1._id.toString());
    expect(task.labels[1].toString()).toBe(label2._id.toString());
    expect(task.completedAt).toBeUndefined();
  });

  it("uses default values correctly", async () => {
    const task = await Task.create({
      title: "Simple task",
      projectId,
      userId,
      columnId: "todo",
    });

    expect(task.priority).toBe("medium");
    expect(task.order).toBe(0);
    expect(task.labels).toEqual([]);
    expect(task.recurrence.frequency).toBe("none");
    expect(task.recurrence.interval).toBe(1);
  });

  it("requires title field", async () => {
    await expect(
      Task.create({ projectId, userId, columnId: "todo" }),
    ).rejects.toThrow(/title.*required/i);
  });

  it("requires projectId field", async () => {
    await expect(
      Task.create({ title: "Test", userId, columnId: "todo" }),
    ).rejects.toThrow(/projectId.*required/i);
  });

  it("requires userId field", async () => {
    await expect(
      Task.create({ title: "Test", projectId, columnId: "todo" }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("requires columnId field", async () => {
    await expect(
      Task.create({ title: "Test", projectId, userId }),
    ).rejects.toThrow(/columnId.*required/i);
  });

  it("validates priority enum", async () => {
    await expect(
      Task.create({
        title: "Test",
        projectId,
        userId,
        columnId: "todo",
        priority: "invalid" as never,
      }),
    ).rejects.toThrow(/priority/i);
  });

  it("validates recurrence frequency enum", async () => {
    await expect(
      Task.create({
        title: "Test",
        projectId,
        userId,
        columnId: "todo",
        recurrence: { frequency: "invalid" as never, interval: 1 },
      }),
    ).rejects.toThrow(/frequency/i);
  });

  it("stores recurrence settings", async () => {
    const endDate = new Date("2026-12-31");
    const task = await Task.create({
      title: "Weekly review",
      projectId,
      userId,
      columnId: "todo",
      recurrence: {
        frequency: "weekly",
        interval: 2,
        endDate,
      },
    });

    expect(task.recurrence.frequency).toBe("weekly");
    expect(task.recurrence.interval).toBe(2);
    expect(task.recurrence.endDate).toEqual(endDate);
  });

  it("creates task with subtasks", async () => {
    const task = await Task.create({
      title: "With subtasks",
      projectId,
      userId,
      columnId: "todo",
      subtasks: [
        { title: "Step 1", completed: false },
        { title: "Step 2", completed: true },
      ],
    });

    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0].title).toBe("Step 1");
    expect(task.subtasks[0].completed).toBe(false);
    expect(task.subtasks[0]._id).toBeDefined();
    expect(task.subtasks[1].title).toBe("Step 2");
    expect(task.subtasks[1].completed).toBe(true);
  });

  it("defaults subtasks to empty array", async () => {
    const task = await Task.create({
      title: "No subtasks",
      projectId,
      userId,
      columnId: "todo",
    });

    expect(task.subtasks).toEqual([]);
  });

  it("validates subtask title is required", async () => {
    await expect(
      Task.create({
        title: "Bad subtask",
        projectId,
        userId,
        columnId: "todo",
        subtasks: [{ completed: false }],
      }),
    ).rejects.toThrow(/title.*required/i);
  });

  it("queries tasks sorted by priority and order", async () => {
    await Task.create([
      {
        title: "Low task",
        projectId,
        userId,
        columnId: "todo",
        priority: "low",
        order: 0,
      },
      {
        title: "Urgent task",
        projectId,
        userId,
        columnId: "todo",
        priority: "urgent",
        order: 0,
      },
      {
        title: "High task",
        projectId,
        userId,
        columnId: "todo",
        priority: "high",
        order: 1,
      },
    ]);

    const tasks = await Task.find({ projectId, columnId: "todo" }).sort({
      order: 1,
    });

    expect(tasks).toHaveLength(3);
    // Sorted by order: Low(0), Urgent(0), High(1)
    expect(tasks[0].order).toBe(0);
    expect(tasks[2].title).toBe("High task");
  });

  it("defaults statusHistory to empty array", async () => {
    const task = await Task.create({
      title: "No history",
      projectId,
      userId,
      columnId: "todo",
    });

    expect(task.statusHistory).toEqual([]);
  });

  it("stores statusHistory entries with columnId and timestamp", async () => {
    const now = new Date("2026-02-14T10:00:00Z");
    const later = new Date("2026-02-14T14:00:00Z");
    const task = await Task.create({
      title: "With history",
      projectId,
      userId,
      columnId: "in-progress",
      statusHistory: [
        { columnId: "todo", timestamp: now },
        { columnId: "in-progress", timestamp: later },
      ],
    });

    expect(task.statusHistory).toHaveLength(2);
    expect(task.statusHistory[0].columnId).toBe("todo");
    expect(task.statusHistory[0].timestamp).toEqual(now);
    expect(task.statusHistory[1].columnId).toBe("in-progress");
    expect(task.statusHistory[1].timestamp).toEqual(later);
  });

  it("persists and retrieves statusHistory correctly", async () => {
    const timestamp = new Date("2026-02-14T12:00:00Z");
    const created = await Task.create({
      title: "Persist history",
      projectId,
      userId,
      columnId: "todo",
      statusHistory: [{ columnId: "todo", timestamp }],
    });

    const retrieved = await Task.findById(created._id);
    expect(retrieved!.statusHistory).toHaveLength(1);
    expect(retrieved!.statusHistory[0].columnId).toBe("todo");
    expect(retrieved!.statusHistory[0].timestamp).toEqual(timestamp);
  });

  it("rejects title exceeding maxlength of 200", async () => {
    await expect(
      Task.create({
        title: "x".repeat(201),
        projectId,
        userId,
        columnId: "todo",
      }),
    ).rejects.toThrow();
  });

  it("rejects description exceeding maxlength of 2000", async () => {
    await expect(
      Task.create({
        title: "Test",
        description: "x".repeat(2001),
        projectId,
        userId,
        columnId: "todo",
      }),
    ).rejects.toThrow();
  });

  it("rejects more than 50 subtasks", async () => {
    const subtasks = Array.from({ length: 51 }, (_, i) => ({
      title: `Subtask ${i}`,
      completed: false,
    }));
    await expect(
      Task.create({
        title: "Too many subtasks",
        projectId,
        userId,
        columnId: "todo",
        subtasks,
      }),
    ).rejects.toThrow(/more than 50 subtasks/i);
  });

  it("allows exactly 50 subtasks", async () => {
    const subtasks = Array.from({ length: 50 }, (_, i) => ({
      title: `Subtask ${i}`,
      completed: false,
    }));
    const task = await Task.create({
      title: "Max subtasks",
      projectId,
      userId,
      columnId: "todo",
      subtasks,
    });
    expect(task.subtasks).toHaveLength(50);
  });

  it("queries tasks by due date range", async () => {
    const today = new Date("2026-02-13");
    const tomorrow = new Date("2026-02-14");
    const nextWeek = new Date("2026-02-20");

    await Task.create([
      {
        title: "Due today",
        projectId,
        userId,
        columnId: "todo",
        dueDate: today,
      },
      {
        title: "Due tomorrow",
        projectId,
        userId,
        columnId: "todo",
        dueDate: tomorrow,
      },
      {
        title: "Due next week",
        projectId,
        userId,
        columnId: "todo",
        dueDate: nextWeek,
      },
    ]);

    const upcomingTasks = await Task.find({
      userId,
      dueDate: { $gte: today, $lte: tomorrow },
    }).sort({ dueDate: 1 });

    expect(upcomingTasks).toHaveLength(2);
    expect(upcomingTasks[0].title).toBe("Due today");
    expect(upcomingTasks[1].title).toBe("Due tomorrow");
  });
});
