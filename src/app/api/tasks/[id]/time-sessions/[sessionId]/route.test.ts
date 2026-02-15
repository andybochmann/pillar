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

import { DELETE } from "./route";

describe("DELETE /api/tasks/[id]/time-sessions/[sessionId]", () => {
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

  function makeRequest() {
    return new Request("http://localhost:3000/api/tasks/123/time-sessions/456", {
      method: "DELETE",
    });
  }

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "123", sessionId: "456" }),
    });
    expect(res.status).toBe(401);
  });

  it("deletes a time session", async () => {
    await setupFixtures();
    const start = new Date("2026-02-14T09:00:00Z");
    const end = new Date("2026-02-14T10:00:00Z");
    const task = await createTestTask({
      projectId,
      userId,
      timeSessions: [{ startedAt: start, endedAt: end, userId }],
    });

    const sessionIdStr = task.timeSessions[0]._id.toString();

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({
        id: task._id.toString(),
        sessionId: sessionIdStr,
      }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.timeSessions).toHaveLength(0);
  });

  it("returns 404 for non-existent task", async () => {
    await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({
        id: fakeId.toString(),
        sessionId: "000000000000000000000000",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent session", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      timeSessions: [
        { startedAt: new Date(), endedAt: new Date(), userId },
      ],
    });
    const fakeSessId = new mongoose.Types.ObjectId();

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({
        id: task._id.toString(),
        sessionId: fakeSessId.toString(),
      }),
    });
    expect(res.status).toBe(404);
  });

  it("only deletes the specified session, keeping others", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      timeSessions: [
        { startedAt: new Date("2026-02-14T09:00:00Z"), endedAt: new Date("2026-02-14T10:00:00Z"), userId },
        { startedAt: new Date("2026-02-14T14:00:00Z"), endedAt: new Date("2026-02-14T15:00:00Z"), userId },
      ],
    });

    const sessionToDelete = task.timeSessions[0]._id.toString();

    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({
        id: task._id.toString(),
        sessionId: sessionToDelete,
      }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.timeSessions).toHaveLength(1);
    expect(data.timeSessions[0].startedAt).toContain("2026-02-14T14:00:00");
  });
});
