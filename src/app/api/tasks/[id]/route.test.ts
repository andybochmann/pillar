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
import { Task } from "@/models/task";
import { PATCH, DELETE } from "./route";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("PATCH /api/tasks/[id]", () => {
  let userId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function setupFixtures() {
    const user = await createTestUser({ email: "patch@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
      columns: [
        { id: "todo", name: "To Do", order: 0 },
        { id: "done", name: "Done", order: 1 },
      ],
    });
    projectId = project._id as mongoose.Types.ObjectId;
  }

  function createRequest(id: string, body: Record<string, unknown>) {
    return {
      request: new NextRequest(`http://localhost:3000/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      params: Promise.resolve({ id }),
    };
  }

  it("updates subtasks on a task", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });

    const subtasks = [
      { title: "Sub A", completed: false },
      { title: "Sub B", completed: true },
    ];

    const { request, params } = createRequest(task._id.toString(), {
      subtasks,
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subtasks).toHaveLength(2);
    expect(data.subtasks[0].title).toBe("Sub A");
    expect(data.subtasks[0].completed).toBe(false);
    expect(data.subtasks[1].title).toBe("Sub B");
    expect(data.subtasks[1].completed).toBe(true);
  });

  it("clones subtasks with completed reset on recurrence", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      dueDate: new Date("2026-03-01"),
      recurrence: { frequency: "weekly", interval: 1 },
      subtasks: [
        { title: "Check A", completed: true },
        { title: "Check B", completed: true },
      ],
    });

    const { request, params } = createRequest(task._id.toString(), {
      completedAt: new Date().toISOString(),
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(200);

    // Find the cloned task
    const allTasks = await Task.find({ userId, projectId });
    const cloned = allTasks.find((t) => t._id.toString() !== task._id.toString());
    expect(cloned).toBeDefined();
    expect(cloned!.subtasks).toHaveLength(2);
    expect(cloned!.subtasks[0].title).toBe("Check A");
    expect(cloned!.subtasks[0].completed).toBe(false);
    expect(cloned!.subtasks[1].title).toBe("Check B");
    expect(cloned!.subtasks[1].completed).toBe(false);
  });

  it("appends statusHistory entry when columnId changes", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      statusHistory: [{ columnId: "todo", timestamp: new Date() }],
    });

    const { request, params } = createRequest(task._id.toString(), {
      columnId: "done",
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusHistory).toHaveLength(2);
    expect(data.statusHistory[1].columnId).toBe("done");
    expect(data.statusHistory[1].timestamp).toBeDefined();
  });

  it("does NOT append statusHistory when columnId is the same", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      statusHistory: [{ columnId: "todo", timestamp: new Date() }],
    });

    const { request, params } = createRequest(task._id.toString(), {
      columnId: "todo",
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusHistory).toHaveLength(1);
  });

  it("does NOT touch statusHistory when updating other fields", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      statusHistory: [{ columnId: "todo", timestamp: new Date() }],
    });

    const { request, params } = createRequest(task._id.toString(), {
      title: "Updated title",
      priority: "high",
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusHistory).toHaveLength(1);
    expect(data.title).toBe("Updated title");
  });

  it("accumulates multiple column moves in statusHistory", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      statusHistory: [{ columnId: "todo", timestamp: new Date() }],
    });

    // Move to in-progress
    const move1 = createRequest(task._id.toString(), {
      columnId: "done",
    });
    await PATCH(move1.request, { params: move1.params });

    // Move to done — need to re-read to verify
    const updated = await Task.findById(task._id);
    expect(updated!.statusHistory).toHaveLength(2);
    expect(updated!.statusHistory[0].columnId).toBe("todo");
    expect(updated!.statusHistory[1].columnId).toBe("done");
  });

  it("seeds statusHistory on recurring task creation", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      dueDate: new Date("2026-03-01"),
      recurrence: { frequency: "weekly", interval: 1 },
      statusHistory: [{ columnId: "todo", timestamp: new Date() }],
    });

    const { request, params } = createRequest(task._id.toString(), {
      completedAt: new Date().toISOString(),
    });
    await PATCH(request, { params });

    // Find the cloned task
    const allTasks = await Task.find({ userId, projectId });
    const cloned = allTasks.find((t) => t._id.toString() !== task._id.toString());
    expect(cloned).toBeDefined();
    expect(cloned!.statusHistory).toHaveLength(1);
    expect(cloned!.statusHistory[0].columnId).toBe("todo");
  });

  it("sets reminderAt on a task", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });
    const reminderDate = "2026-03-15T10:30:00.000Z";

    const { request, params } = createRequest(task._id.toString(), {
      reminderAt: reminderDate,
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reminderAt).toBe(reminderDate);
  });

  it("clears reminderAt when set to null", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      reminderAt: new Date("2026-03-15T10:30:00.000Z"),
    });

    const { request, params } = createRequest(task._id.toString(), {
      reminderAt: null,
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reminderAt).toBeNull();
  });

  it("returns 404 for non-existent task", async () => {
    await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const { request, params } = createRequest(fakeId, { title: "Updated" });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid subtask data", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });
    const { request, params } = createRequest(task._id.toString(), {
      subtasks: [{ completed: false }],
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
  });

  it("archives a task", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });

    const { request, params } = createRequest(task._id.toString(), {
      archived: true,
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.archived).toBe(true);
    expect(data.archivedAt).toBeDefined();
    expect(data.archivedAt).not.toBeNull();
  });

  it("unarchives a task", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      archived: true,
      archivedAt: new Date(),
    });

    const { request, params } = createRequest(task._id.toString(), {
      archived: false,
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.archived).toBe(false);
    expect(data.archivedAt).toBeNull();
  });

  it("returns 403 when viewer tries to update a task", async () => {
    await setupFixtures();
    const viewer = await createTestUser({ email: "viewer@example.com" });
    await createTestProjectMember({
      projectId,
      userId: viewer._id as mongoose.Types.ObjectId,
      role: "viewer",
      invitedBy: userId,
    });
    const task = await createTestTask({ projectId, userId });
    session.user.id = viewer._id.toString();

    const { request, params } = createRequest(task._id.toString(), {
      title: "Should fail",
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Viewers cannot edit tasks");

    session.user.id = userId.toString();
  });

  it("returns 403 when viewer tries to delete a task", async () => {
    await setupFixtures();
    const viewer = await createTestUser({ email: "viewer-del@example.com" });
    await createTestProjectMember({
      projectId,
      userId: viewer._id as mongoose.Types.ObjectId,
      role: "viewer",
      invitedBy: userId,
    });
    const task = await createTestTask({ projectId, userId });
    session.user.id = viewer._id.toString();

    const req = new NextRequest(
      `http://localhost:3000/api/tasks/${task._id.toString()}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: task._id.toString() }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Viewers cannot delete tasks");

    session.user.id = userId.toString();
  });
});
