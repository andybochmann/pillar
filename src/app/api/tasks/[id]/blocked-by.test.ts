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
import { PATCH } from "./route";

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

describe("PATCH /api/tasks/[id] — blockedBy dependencies", () => {
  let userId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;
  let otherProjectId: mongoose.Types.ObjectId;

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
    const user = await createTestUser({ email: "dep@example.com" });
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
    await createTestProjectMember({
      projectId,
      userId,
      role: "owner",
      invitedBy: userId,
    });

    const otherProject = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
    });
    otherProjectId = otherProject._id as mongoose.Types.ObjectId;
    await createTestProjectMember({
      projectId: otherProjectId,
      userId,
      role: "owner",
      invitedBy: userId,
    });
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

  it("sets blockedBy to valid same-project tasks", async () => {
    await setupFixtures();
    const a = await createTestTask({ projectId, userId, title: "A" });
    const b = await createTestTask({ projectId, userId, title: "B" });

    const { request, params } = createRequest(a._id.toString(), {
      blockedBy: [b._id.toString()],
    });
    const res = await PATCH(request, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.blockedBy.map(String)).toEqual([b._id.toString()]);
  });

  it("rejects a self-dependency with 400", async () => {
    await setupFixtures();
    const a = await createTestTask({ projectId, userId });

    const { request, params } = createRequest(a._id.toString(), {
      blockedBy: [a._id.toString()],
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
  });

  it("rejects a blocker from another project with 400", async () => {
    await setupFixtures();
    const a = await createTestTask({ projectId, userId });
    const foreign = await createTestTask({ projectId: otherProjectId, userId });

    const { request, params } = createRequest(a._id.toString(), {
      blockedBy: [foreign._id.toString()],
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
  });

  it("rejects a direct cycle with 400", async () => {
    await setupFixtures();
    const a = await createTestTask({ projectId, userId, title: "A" });
    const b = await createTestTask({
      projectId,
      userId,
      title: "B",
      blockedBy: [a._id],
    });

    // b is blocked by a; making a blocked by b closes the loop
    const { request, params } = createRequest(a._id.toString(), {
      blockedBy: [b._id.toString()],
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
  });

  it("rejects a transitive cycle with 400", async () => {
    await setupFixtures();
    const a = await createTestTask({ projectId, userId, title: "A" });
    const b = await createTestTask({
      projectId,
      userId,
      title: "B",
      blockedBy: [a._id],
    });
    const c = await createTestTask({
      projectId,
      userId,
      title: "C",
      blockedBy: [b._id],
    });

    // c → b → a; making a blocked by c closes the loop
    const { request, params } = createRequest(a._id.toString(), {
      blockedBy: [c._id.toString()],
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
  });

  it("blocks completion (409) while a blocker is still open", async () => {
    await setupFixtures();
    const blocker = await createTestTask({ projectId, userId, title: "Blocker" });
    const task = await createTestTask({
      projectId,
      userId,
      title: "Dependent",
      blockedBy: [blocker._id],
    });

    const { request, params } = createRequest(task._id.toString(), {
      completedAt: new Date().toISOString(),
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(409);

    const reloaded = await Task.findById(task._id);
    expect(reloaded?.completedAt).toBeFalsy();
  });

  it("allows completion once all blockers are completed", async () => {
    await setupFixtures();
    const blocker = await createTestTask({
      projectId,
      userId,
      title: "Blocker",
      completedAt: new Date(),
    });
    const task = await createTestTask({
      projectId,
      userId,
      title: "Dependent",
      blockedBy: [blocker._id],
    });

    const { request, params } = createRequest(task._id.toString(), {
      completedAt: new Date().toISOString(),
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.completedAt).toBeTruthy();
  });

  it("allows reopening a completed task even when blockers are open", async () => {
    await setupFixtures();
    const blocker = await createTestTask({ projectId, userId, title: "Blocker" });
    const task = await createTestTask({
      projectId,
      userId,
      title: "Dependent",
      blockedBy: [blocker._id],
      completedAt: new Date(),
    });

    const { request, params } = createRequest(task._id.toString(), {
      completedAt: null,
    });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.completedAt).toBeFalsy();
  });
});
