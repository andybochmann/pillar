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
import { POST } from "./route";

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

describe("POST /api/tasks/[id]/complete", () => {
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
    const user = await createTestUser({ email: "complete@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
      columns: [
        { id: "todo", name: "To Do", order: 0 },
        { id: "in-progress", name: "In Progress", order: 1 },
        { id: "done", name: "Done", order: 2 },
      ],
    });
    projectId = project._id as mongoose.Types.ObjectId;
  }

  function createRequest(id: string) {
    return {
      request: new Request(`http://localhost:3000/api/tasks/${id}/complete`, {
        method: "POST",
      }),
      params: Promise.resolve({ id }),
    };
  }

  it("returns 401 when not authenticated", async () => {
    const originalId = session.user.id;
    // @ts-expect-error — testing null session
    session.user = null;

    const { request, params } = createRequest("507f1f77bcf86cd799439011");
    const res = await POST(request, { params });
    expect(res.status).toBe(401);

    session.user = { id: originalId, name: "Test User", email: "test@example.com" };
  });

  it("returns 404 for non-existent task", async () => {
    await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const { request, params } = createRequest(fakeId);
    const res = await POST(request, { params });
    expect(res.status).toBe(404);
  });

  it("returns 403 for viewer role", async () => {
    await setupFixtures();

    // Create another user as viewer
    const viewer = await createTestUser({ email: "viewer@example.com" });
    await createTestProjectMember({
      projectId,
      userId: viewer._id as mongoose.Types.ObjectId,
      role: "viewer",
      invitedBy: userId,
    });

    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
    });

    session.user.id = viewer._id.toString();
    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(403);

    session.user.id = userId.toString();
  });

  it("completes a task and moves it to the done column", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      title: "Complete me",
    });

    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.completedAt).toBeDefined();
    expect(data.columnId).toBe("done");
    expect(data.statusHistory).toHaveLength(1);
    expect(data.statusHistory[0].columnId).toBe("done");
  });

  it("returns already-completed task as-is", async () => {
    await setupFixtures();
    const completedAt = new Date();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "done",
      completedAt,
    });

    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(new Date(data.completedAt).getTime()).toBe(completedAt.getTime());
  });

  it("creates next occurrence for recurring tasks", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      title: "Recurring task",
      dueDate: new Date("2026-03-01"),
      recurrence: { frequency: "weekly", interval: 1 },
    });

    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(200);

    // Should have created a new recurring task
    const allTasks = await Task.find({ projectId });
    expect(allTasks).toHaveLength(2);

    const newTask = allTasks.find(
      (t) => t._id.toString() !== task._id.toString(),
    );
    expect(newTask).toBeDefined();
    expect(newTask!.title).toBe("Recurring task");
    expect(newTask!.columnId).toBe("todo");
    expect(newTask!.completedAt).toBeUndefined();
    expect(newTask!.dueDate!.getTime()).toBeGreaterThan(
      new Date("2026-03-01").getTime(),
    );
  });

  it("does not create recurrence past endDate", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      columnId: "todo",
      title: "Limited recurrence",
      dueDate: new Date("2026-03-01"),
      recurrence: {
        frequency: "weekly",
        interval: 1,
        endDate: new Date("2026-03-05"),
      },
    });

    const { request, params } = createRequest(task._id.toString());
    await POST(request, { params });

    const allTasks = await Task.find({ projectId });
    // Next due date would be 2026-03-08 which is past endDate 2026-03-05
    expect(allTasks).toHaveLength(1);
  });
});
