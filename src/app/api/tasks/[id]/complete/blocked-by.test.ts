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

describe("POST /api/tasks/[id]/complete — blocker guard", () => {
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
    const user = await createTestUser({ email: "complete-dep@example.com" });
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
  }

  function createRequest(id: string) {
    return {
      request: new Request(`http://localhost:3000/api/tasks/${id}/complete`, {
        method: "POST",
      }),
      params: Promise.resolve({ id }),
    };
  }

  it("returns 409 when a blocker is still open", async () => {
    await setupFixtures();
    const blocker = await createTestTask({ projectId, userId, title: "Blocker" });
    const task = await createTestTask({
      projectId,
      userId,
      title: "Dependent",
      blockedBy: [blocker._id],
    });

    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(409);

    const reloaded = await Task.findById(task._id);
    expect(reloaded?.completedAt).toBeFalsy();
  });

  it("completes when all blockers are resolved", async () => {
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

    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.completedAt).toBeTruthy();
  });

  it("treats an archived blocker as resolved", async () => {
    await setupFixtures();
    const blocker = await createTestTask({
      projectId,
      userId,
      title: "Blocker",
      archived: true,
    });
    const task = await createTestTask({
      projectId,
      userId,
      title: "Dependent",
      blockedBy: [blocker._id],
    });

    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(200);
  });
});
