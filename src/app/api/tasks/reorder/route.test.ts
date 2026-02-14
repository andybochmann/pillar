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

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("PATCH /api/tasks/reorder", () => {
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
    const user = await createTestUser({ email: "reorder@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
    });
    projectId = project._id as mongoose.Types.ObjectId;
  }

  function createRequest(body: unknown) {
    return new NextRequest("http://localhost:3000/api/tasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("reorders tasks successfully", async () => {
    await setupFixtures();
    const task1 = await createTestTask({
      projectId,
      userId,
      title: "Task 1",
      order: 0,
    });
    const task2 = await createTestTask({
      projectId,
      userId,
      title: "Task 2",
      order: 1,
    });
    const task3 = await createTestTask({
      projectId,
      userId,
      title: "Task 3",
      order: 2,
    });

    const res = await PATCH(
      createRequest({
        tasks: [
          { id: task3._id.toString(), order: 0 },
          { id: task1._id.toString(), order: 1 },
          { id: task2._id.toString(), order: 2 },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify orders were updated
    const { Task } = await import("@/models/task");
    const updated1 = await Task.findById(task1._id);
    const updated2 = await Task.findById(task2._id);
    const updated3 = await Task.findById(task3._id);
    expect(updated1?.order).toBe(1);
    expect(updated2?.order).toBe(2);
    expect(updated3?.order).toBe(0);
  });

  it("returns 400 for empty tasks array", async () => {
    await setupFixtures();
    const res = await PATCH(createRequest({ tasks: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid body", async () => {
    await setupFixtures();
    const res = await PATCH(createRequest({ tasks: [{ id: "" }] }));
    expect(res.status).toBe(400);
  });

  it("returns 404 if a task does not exist", async () => {
    await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await PATCH(
      createRequest({
        tasks: [{ id: fakeId, order: 0 }],
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await PATCH(
      createRequest({ tasks: [{ id: "abc", order: 0 }] }),
    );
    expect(res.status).toBe(401);
  });
});
