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
  createTestProjectMember,
} from "@/test/helpers";
import { PATCH, DELETE } from "./route";

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
    await createTestProjectMember({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      role: "owner",
      invitedBy: userId,
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
    await seedTasks();
    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({ taskIds: [task1Id], action: "move" }),
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

  it("appends statusHistory entries on bulk move", async () => {
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
    for (const t of tasks) {
      expect(t.statusHistory.length).toBeGreaterThanOrEqual(1);
      const lastEntry = t.statusHistory[t.statusHistory.length - 1];
      expect(lastEntry.columnId).toBe("done");
      expect(lastEntry.timestamp).toBeDefined();
    }
  });

  it("does not add duplicate statusHistory for tasks already in target column", async () => {
    await seedTasks();

    // Move task1 to "done" first
    const { Task } = await import("@/models/task");
    await Task.findByIdAndUpdate(task1Id, {
      $set: { columnId: "done" },
      $push: { statusHistory: { columnId: "done", timestamp: new Date() } },
    });

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

    // task1 was already in "done" — should NOT get another history entry
    const task1 = await Task.findById(task1Id);
    expect(task1!.statusHistory).toHaveLength(1);

    // task2 was in "todo" — should get a history entry
    const task2 = await Task.findById(task2Id);
    const doneEntries = task2!.statusHistory.filter(
      (e) => e.columnId === "done",
    );
    expect(doneEntries).toHaveLength(1);
  });

  it("archives tasks with archive action", async () => {
    await seedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({
        taskIds: [task1Id, task2Id],
        action: "archive",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const { Task } = await import("@/models/task");
    const tasks = await Task.find({ _id: { $in: [task1Id, task2Id] } });
    expect(tasks.every((t) => t.archived === true)).toBe(true);
    expect(tasks.every((t) => t.archivedAt != null)).toBe(true);
  });

  it("only affects tasks in accessible projects", async () => {
    await seedTasks();
    // Create a task owned by another user in a separate project
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

    // Own task deleted (user has access via ProjectMember record)
    const ownCount = await Task.countDocuments({ _id: task1Id });
    expect(ownCount).toBe(0);
    // Other user's task still exists (not accessible)
    const otherCount = await Task.countDocuments({ _id: otherTask._id });
    expect(otherCount).toBe(1);
  });

  it("cascade-deletes notes when bulk-deleting tasks via PATCH", async () => {
    await seedTasks();

    const { Note } = await import("@/models/note");
    await Note.create({
      title: "Task 1 note",
      content: "content",
      parentType: "task",
      taskId: task1Id,
      projectId: (
        await (await import("@/models/task")).Task.findById(task1Id)
      )!.projectId,
      userId: session.user.id,
    });

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({
        taskIds: [task1Id],
        action: "delete",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const noteCount = await Note.countDocuments({ taskId: task1Id });
    expect(noteCount).toBe(0);
  });
});

describe("DELETE /api/tasks/bulk", () => {
  let projectId: string;
  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function seedArchivedTasks() {
    const user = await createTestUser({ email: "test@test.com" });
    const userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const cat = await createTestCategory({ userId });
    const project = await createTestProject({
      userId,
      categoryId: cat._id as mongoose.Types.ObjectId,
    });
    await createTestProjectMember({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      role: "owner",
      invitedBy: userId,
    });
    projectId = (project._id as mongoose.Types.ObjectId).toString();

    const now = new Date();
    const t1 = await createTestTask({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      columnId: "todo",
      title: "Old archived",
      archived: true,
      archivedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
    });
    const t2 = await createTestTask({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      columnId: "todo",
      title: "Recent archived",
      archived: true,
      archivedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    });
    const t3 = await createTestTask({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      columnId: "todo",
      title: "Not archived",
    });

    task1Id = t1._id.toString();
    task2Id = t2._id.toString();
    task3Id = t3._id.toString();
  }

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({ projectId: "proj-1" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when projectId is missing", async () => {
    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when user has no access to project", async () => {
    // Create project owned by another user
    const otherUser = await createTestUser({ email: "other@test.com" });
    const otherUserId = otherUser._id as mongoose.Types.ObjectId;
    const cat = await createTestCategory({ userId: otherUserId });
    const project = await createTestProject({
      userId: otherUserId,
      categoryId: cat._id as mongoose.Types.ObjectId,
    });

    // Current session user is different
    const user = await createTestUser({ email: "me@test.com" });
    session.user.id = (user._id as mongoose.Types.ObjectId).toString();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({
        projectId: (project._id as mongoose.Types.ObjectId).toString(),
      }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is a viewer", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const viewer = await createTestUser({ email: "viewer@test.com" });
    const ownerUserId = owner._id as mongoose.Types.ObjectId;
    const viewerUserId = viewer._id as mongoose.Types.ObjectId;
    session.user.id = viewerUserId.toString();

    const cat = await createTestCategory({ userId: ownerUserId });
    const project = await createTestProject({
      userId: ownerUserId,
      categoryId: cat._id as mongoose.Types.ObjectId,
    });

    await createTestProjectMember({
      projectId: project._id as mongoose.Types.ObjectId,
      userId: ownerUserId,
      role: "owner",
      invitedBy: ownerUserId,
    });
    await createTestProjectMember({
      projectId: project._id as mongoose.Types.ObjectId,
      userId: viewerUserId,
      role: "viewer",
      invitedBy: ownerUserId,
    });

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({
        projectId: (project._id as mongoose.Types.ObjectId).toString(),
      }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("deletes all archived tasks when no taskIds or olderThanDays", async () => {
    await seedArchivedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({ projectId }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deletedCount).toBe(2);

    // Non-archived task should still exist
    const { Task } = await import("@/models/task");
    const remaining = await Task.find({ projectId });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]._id.toString()).toBe(task3Id);
  });

  it("deletes only selected archived tasks by taskIds", async () => {
    await seedArchivedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({ projectId, taskIds: [task1Id] }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedCount).toBe(1);

    // task2 (archived) and task3 (not archived) should remain
    const { Task } = await import("@/models/task");
    const remaining = await Task.find({ projectId });
    expect(remaining).toHaveLength(2);
    const remainingIds = remaining.map((t) => t._id.toString());
    expect(remainingIds).toContain(task2Id);
    expect(remainingIds).toContain(task3Id);
  });

  it("ignores non-archived tasks in taskIds", async () => {
    await seedArchivedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({ projectId, taskIds: [task3Id] }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedCount).toBe(0);

    // task3 is not archived, should not be deleted
    const { Task } = await import("@/models/task");
    const count = await Task.countDocuments({ _id: task3Id });
    expect(count).toBe(1);
  });

  it("deletes archived tasks older than specified days", async () => {
    await seedArchivedTasks();

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({ projectId, olderThanDays: 30 }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedCount).toBe(1); // only task1 (60 days old)

    const { Task } = await import("@/models/task");
    const remaining = await Task.find({ projectId });
    expect(remaining).toHaveLength(2);
    const remainingIds = remaining.map((t) => t._id.toString());
    expect(remainingIds).toContain(task2Id);
    expect(remainingIds).toContain(task3Id);
  });

  it("cascade-deletes notes for deleted tasks", async () => {
    await seedArchivedTasks();

    const { Note } = await import("@/models/note");
    await Note.create({
      title: "Note for archived task",
      content: "content",
      parentType: "task",
      taskId: task1Id,
      projectId,
      userId: session.user.id,
    });
    await Note.create({
      title: "Note for non-archived task",
      content: "content",
      parentType: "task",
      taskId: task3Id,
      projectId,
      userId: session.user.id,
    });

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({ projectId }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);

    // Note for archived task should be deleted
    const archivedNotes = await Note.countDocuments({ taskId: task1Id });
    expect(archivedNotes).toBe(0);
    // Note for non-archived task should remain
    const otherNotes = await Note.countDocuments({ taskId: task3Id });
    expect(otherNotes).toBe(1);
  });

  it("returns deletedCount 0 when no archived tasks exist", async () => {
    const user = await createTestUser({ email: "test@test.com" });
    const userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const cat = await createTestCategory({ userId });
    const project = await createTestProject({
      userId,
      categoryId: cat._id as mongoose.Types.ObjectId,
    });
    await createTestProjectMember({
      projectId: project._id as mongoose.Types.ObjectId,
      userId,
      role: "owner",
      invitedBy: userId,
    });

    const req = new NextRequest("http://localhost/api/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({
        projectId: (project._id as mongoose.Types.ObjectId).toString(),
      }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedCount).toBe(0);
  });
});
