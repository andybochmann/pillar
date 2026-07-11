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
import { Notification } from "@/models/notification";

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

import { GET, POST } from "./route";

describe("/api/tasks/[id]/comments", () => {
  let userId: mongoose.Types.ObjectId;
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

  async function setupFixtures(role: "owner" | "editor" | "viewer" = "owner") {
    const user = await createTestUser({ name: "Author", email: "author@example.com" });
    userId = user._id;
    session.user.id = userId.toString();
    const category = await createTestCategory({ userId });
    const project = await createTestProject({ userId, categoryId: category._id });
    projectId = project._id;
    await createTestProjectMember({
      projectId,
      userId,
      role,
      invitedBy: userId,
    });
    const task = await createTestTask({ projectId, userId, title: "Fix bug" });
    taskId = task._id;
    return { user, project, task };
  }

  function makeGet() {
    return new Request(`http://localhost/api/tasks/${taskId}/comments`);
  }

  function makePost(body: unknown) {
    return new Request(`http://localhost/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const params = () => ({ params: Promise.resolve({ id: taskId.toString() }) });

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/tasks/x/comments"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the task is not accessible", async () => {
    await setupFixtures();
    // A different task the user has no membership on
    const otherUser = await createTestUser({ email: "other@example.com" });
    const cat = await createTestCategory({ userId: otherUser._id });
    const proj = await createTestProject({ userId: otherUser._id, categoryId: cat._id });
    const foreignTask = await createTestTask({ projectId: proj._id, userId: otherUser._id });

    const res = await GET(
      new Request(`http://localhost/api/tasks/${foreignTask._id}/comments`),
      { params: Promise.resolve({ id: foreignTask._id.toString() }) },
    );
    expect(res.status).toBe(404);
  });

  it("lists comments oldest-first", async () => {
    await setupFixtures();
    const first = await createTestComment({ taskId, projectId, userId, body: "first" });
    const second = await createTestComment({ taskId, projectId, userId, body: "second" });
    // Force distinct createdAt ordering
    await Comment.updateOne({ _id: first._id }, { createdAt: new Date("2026-01-01") });
    await Comment.updateOne({ _id: second._id }, { createdAt: new Date("2026-01-02") });

    const res = await GET(makeGet(), params());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.map((c: { body: string }) => c.body)).toEqual(["first", "second"]);
    expect(data[0].authorName).toBe("Author");
  });

  it("creates a comment and returns it with author info", async () => {
    await setupFixtures();
    const res = await POST(makePost({ body: "Nice work" }), params());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.body).toBe("Nice work");
    expect(data.userId).toBe(userId.toString());
    expect(data.authorName).toBe("Author");
    expect(await Comment.countDocuments({ taskId })).toBe(1);
  });

  it("allows a viewer to comment", async () => {
    await setupFixtures("viewer");
    const res = await POST(makePost({ body: "Viewer note" }), params());
    expect(res.status).toBe(201);
  });

  it("rejects an empty body with 400", async () => {
    await setupFixtures();
    const res = await POST(makePost({ body: "   " }), params());
    expect(res.status).toBe(400);
  });

  it("rejects a mention that is not a project member", async () => {
    await setupFixtures();
    const stranger = new mongoose.Types.ObjectId().toString();
    const res = await POST(
      makePost({ body: "hey", mentions: [stranger] }),
      params(),
    );
    expect(res.status).toBe(400);
  });

  it("creates a mention notification for a mentioned member", async () => {
    const { project } = await setupFixtures();
    const mentioned = await createTestUser({ email: "mentioned@example.com", name: "Mira" });
    await createTestProjectMember({
      projectId: project._id,
      userId: mentioned._id,
      role: "editor",
      invitedBy: userId,
    });

    const res = await POST(
      makePost({ body: "cc @Mira", mentions: [mentioned._id.toString()] }),
      params(),
    );
    expect(res.status).toBe(201);

    const notifs = await Notification.find({ userId: mentioned._id, type: "mention" });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].taskId?.toString()).toBe(taskId.toString());
  });

  it("does not notify the author when they mention themselves", async () => {
    await setupFixtures();
    const res = await POST(
      makePost({ body: "note to self @Author", mentions: [userId.toString()] }),
      params(),
    );
    expect(res.status).toBe(201);
    const notifs = await Notification.find({ userId, type: "mention" });
    expect(notifs).toHaveLength(0);
  });
});
