import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
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
  createTestComment,
} from "@/test/helpers";
import { Comment } from "@/models/comment";

const session = vi.hoisted(() => ({
  user: {
    id: "000000000000000000000000",
    name: "Test User",
    email: "test@example.com",
  },
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
  emitNotificationEvent: vi.fn(),
}));

import { DELETE } from "./route";

describe("DELETE /api/tasks/[id]/comments/[commentId]", () => {
  let ownerId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;
  let taskId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function setup() {
    const owner = await createTestUser({ email: "owner@example.com", name: "Owner" });
    ownerId = owner._id;
    const category = await createTestCategory({ userId: ownerId });
    const project = await createTestProject({ userId: ownerId, categoryId: category._id });
    projectId = project._id;
    await createTestProjectMember({ projectId, userId: ownerId, role: "owner", invitedBy: ownerId });
    const task = await createTestTask({ projectId, userId: ownerId });
    taskId = task._id;

    const editor = await createTestUser({ email: "editor@example.com", name: "Editor" });
    await createTestProjectMember({ projectId, userId: editor._id, role: "editor", invitedBy: ownerId });
    return { owner, editor };
  }

  function req() {
    return new Request(`http://localhost/api/tasks/${taskId}/comments/x`, {
      method: "DELETE",
    });
  }

  function params(commentId: string) {
    return { params: Promise.resolve({ id: taskId.toString(), commentId }) };
  }

  it("lets the author delete their own comment", async () => {
    const { editor } = await setup();
    session.user.id = editor._id.toString();
    const comment = await createTestComment({ taskId, projectId, userId: editor._id });

    const res = await DELETE(req(), params(comment._id.toString()));
    expect(res.status).toBe(200);
    expect(await Comment.countDocuments({})).toBe(0);
  });

  it("lets a project owner delete another member's comment", async () => {
    const { owner, editor } = await setup();
    session.user.id = owner._id.toString();
    const comment = await createTestComment({ taskId, projectId, userId: editor._id });

    const res = await DELETE(req(), params(comment._id.toString()));
    expect(res.status).toBe(200);
  });

  it("forbids a non-owner from deleting another member's comment", async () => {
    const { owner, editor } = await setup();
    session.user.id = editor._id.toString();
    const comment = await createTestComment({ taskId, projectId, userId: owner._id });

    const res = await DELETE(req(), params(comment._id.toString()));
    expect(res.status).toBe(403);
    expect(await Comment.countDocuments({})).toBe(1);
  });

  it("returns 404 for a missing comment", async () => {
    const { owner } = await setup();
    session.user.id = owner._id.toString();
    const res = await DELETE(req(), params(new mongoose.Types.ObjectId().toString()));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the user has no project access", async () => {
    const { editor } = await setup();
    const comment = await createTestComment({ taskId, projectId, userId: editor._id });
    const stranger = await createTestUser({ email: "stranger@example.com" });
    session.user.id = stranger._id.toString();

    const res = await DELETE(req(), params(comment._id.toString()));
    expect(res.status).toBe(404);
  });
});
