import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
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
    const task = await Task.create({
      title: "Fix bug",
      description: "Fix the login bug",
      projectId,
      userId,
      columnId: "todo",
      priority: "high",
      dueDate,
      order: 0,
      labels: ["bug", "auth"],
    });

    expect(task.title).toBe("Fix bug");
    expect(task.description).toBe("Fix the login bug");
    expect(task.priority).toBe("high");
    expect(task.dueDate).toEqual(dueDate);
    expect(task.columnId).toBe("todo");
    expect(task.order).toBe(0);
    expect(task.labels).toEqual(["bug", "auth"]);
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
    expect(tasks[0].title).toBe("Low task");
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
