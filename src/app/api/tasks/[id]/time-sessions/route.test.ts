import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
  createTestProjectMember,
} from "@/test/helpers";
import { Task } from "@/models/task";

const session = vi.hoisted(() => ({
  user: { id: "000000000000000000000000", name: "Test User", email: "test@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/event-bus", () => ({
  emitSyncEvent: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/tasks/[id]/time-sessions", () => {
  let userId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Task.deleteMany({});
  });

  async function setupFixtures() {
    const user = await createTestUser();
    userId = user._id;
    session.user.id = userId.toString();
    const category = await createTestCategory({ userId });
    const project = await createTestProject({ userId, categoryId: category._id });
    projectId = project._id;
    await createTestProjectMember({
      projectId,
      userId,
      role: "owner",
      invitedBy: userId,
    });
    return { user, project };
  }

  function makeRequest(body: unknown) {
    return new Request("http://localhost:3000/api/tasks/123/time-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ action: "start" }), {
      params: Promise.resolve({ id: "123" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid action", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });

    const res = await POST(makeRequest({ action: "invalid" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(400);
  });

  it("starts a time session", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });

    const res = await POST(makeRequest({ action: "start" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.timeSessions).toHaveLength(1);
    expect(data.timeSessions[0].startedAt).toBeDefined();
    expect(data.timeSessions[0].endedAt).toBeUndefined();
    expect(data.timeSessions[0].userId).toBe(userId.toString());
  });

  it("stops an active time session", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      timeSessions: [{ startedAt: new Date(), userId }],
    });

    const res = await POST(makeRequest({ action: "stop" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.timeSessions).toHaveLength(1);
    expect(data.timeSessions[0].endedAt).toBeDefined();
  });

  it("returns 404 when stopping with no active session", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });

    const res = await POST(makeRequest({ action: "stop" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(404);
  });

  it("auto-stops active session on another task when starting", async () => {
    await setupFixtures();
    const task1 = await createTestTask({
      projectId,
      userId,
      title: "Task 1",
      timeSessions: [{ startedAt: new Date(), userId }],
    });
    const task2 = await createTestTask({
      projectId,
      userId,
      title: "Task 2",
    });

    const res = await POST(makeRequest({ action: "start" }), {
      params: Promise.resolve({ id: task2._id.toString() }),
    });
    expect(res.status).toBe(200);

    // Task 2 should have new active session
    const data = await res.json();
    expect(data.timeSessions).toHaveLength(1);
    expect(data.timeSessions[0].endedAt).toBeUndefined();

    // Task 1's session should be stopped
    const updatedTask1 = await Task.findById(task1._id);
    expect(updatedTask1!.timeSessions[0].endedAt).toBeDefined();
  });

  it("returns 404 for non-existent task", async () => {
    await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await POST(makeRequest({ action: "start" }), {
      params: Promise.resolve({ id: fakeId.toString() }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for task in project user has no access to", async () => {
    await setupFixtures();
    const otherUser = await createTestUser({ email: "other@example.com" });
    const otherCategory = await createTestCategory({ userId: otherUser._id });
    const otherProject = await createTestProject({
      userId: otherUser._id,
      categoryId: otherCategory._id,
    });
    const task = await createTestTask({
      projectId: otherProject._id,
      userId: otherUser._id,
    });

    const res = await POST(makeRequest({ action: "start" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(404);
  });
});
