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
import { NextRequest } from "next/server";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers";
import { PATCH } from "./route";

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

describe("PATCH /api/tasks/bulk", () => {
  let task1Id: string;
  let task2Id: string;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function seedTasks() {
    const user = await createTestUser({ email: "test@test.com" });
    const userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const cat = await createTestCategory({ userId });
    const project = await createTestProject({
      userId,
      categoryId: cat._id as mongoose.Types.ObjectId,
      columns: [
        { id: "todo", name: "To Do", order: 0 },
        { id: "done", name: "Done", order: 1 },
      ],
    });
    const t1 = await createTestTask({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      columnId: "todo",
      title: "Task 1",
      priority: "low",
    });
    const t2 = await createTestTask({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      columnId: "todo",
      title: "Task 2",
      priority: "low",
    });
    task1Id = t1._id.toString();
    task2Id = t2._id.toString();
  }

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({ taskIds: ["x"], action: "delete" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid action", async () => {
    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({ taskIds: ["x"], action: "invalid" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("bulk moves tasks to a column", async () => {
    await seedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({
        taskIds: [task1Id, task2Id],
        action: "move",
        columnId: "done",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const { Task } = await import("@/models/task");
    const tasks = await Task.find({ _id: { $in: [task1Id, task2Id] } });
    expect(tasks.every((t) => t.columnId === "done")).toBe(true);
  });

  it("returns 400 when move action missing columnId", async () => {
    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({ taskIds: ["x"], action: "move" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("bulk updates priority", async () => {
    await seedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({
        taskIds: [task1Id, task2Id],
        action: "priority",
        priority: "urgent",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const { Task } = await import("@/models/task");
    const tasks = await Task.find({ _id: { $in: [task1Id, task2Id] } });
    expect(tasks.every((t) => t.priority === "urgent")).toBe(true);
  });

  it("bulk deletes tasks", async () => {
    await seedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({
        taskIds: [task1Id, task2Id],
        action: "delete",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const { Task } = await import("@/models/task");
    const count = await Task.countDocuments({
      _id: { $in: [task1Id, task2Id] },
    });
    expect(count).toBe(0);
  });

  it("only affects tasks owned by the user", async () => {
    await seedTasks();
    // Create a task owned by another user
    const otherUser = await createTestUser({ email: "other@test.com" });
    const otherUserId = otherUser._id as mongoose.Types.ObjectId;
    const otherCat = await createTestCategory({ userId: otherUserId });
    const otherProject = await createTestProject({
      userId: otherUserId,
      categoryId: otherCat._id as mongoose.Types.ObjectId,
    });
    const { Task } = await import("@/models/task");
    const otherTask = await createTestTask({
      projectId: otherProject._id as mongoose.Types.ObjectId,
      userId: otherUserId,
      columnId: "todo",
      title: "Other user task",
    });

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({
        taskIds: [task1Id, otherTask._id.toString()],
        action: "delete",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    // Own task deleted
    const ownCount = await Task.countDocuments({ _id: task1Id });
    expect(ownCount).toBe(0);
    // Other user's task still exists
    const otherCount = await Task.countDocuments({ _id: otherTask._id });
    expect(otherCount).toBe(1);
  });
});
