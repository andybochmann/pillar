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
import { Notification } from "@/models/notification";
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

describe("POST /api/tasks/[id]/snooze", () => {
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
    const user = await createTestUser({ email: "snooze@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
    });
    projectId = project._id as mongoose.Types.ObjectId;
  }

  function createRequest(id: string, body: Record<string, unknown> = {}) {
    return {
      request: new Request(`http://localhost:3000/api/tasks/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

    const viewer = await createTestUser({ email: "viewer@example.com" });
    await createTestProjectMember({
      projectId,
      userId: viewer._id as mongoose.Types.ObjectId,
      role: "viewer",
      invitedBy: userId,
    });

    const task = await createTestTask({ projectId, userId });

    session.user.id = viewer._id.toString();
    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(403);

    session.user.id = userId.toString();
  });

  it("sets reminderAt to +24 hours", async () => {
    await setupFixtures();
    const task = await createTestTask({
      projectId,
      userId,
      title: "Snooze me",
    });

    const beforeSnooze = Date.now();
    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.snoozedUntil).toBeDefined();

    const updatedTask = await Task.findById(task._id);
    expect(updatedTask!.reminderAt).toBeDefined();

    const expectedMin = beforeSnooze + 24 * 60 * 60 * 1000 - 5000;
    const expectedMax = beforeSnooze + 24 * 60 * 60 * 1000 + 5000;
    const reminderTime = updatedTask!.reminderAt!.getTime();
    expect(reminderTime).toBeGreaterThanOrEqual(expectedMin);
    expect(reminderTime).toBeLessThanOrEqual(expectedMax);
  });

  it("marks notification as read and snoozed when notificationId provided", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });

    const notification = await Notification.create({
      userId,
      taskId: task._id,
      type: "reminder",
      title: "Task reminder",
      message: "Test reminder",
      read: false,
    });

    const { request, params } = createRequest(task._id.toString(), {
      notificationId: notification._id.toString(),
    });
    const res = await POST(request, { params });
    expect(res.status).toBe(200);

    const updatedNotification = await Notification.findById(notification._id);
    expect(updatedNotification!.read).toBe(true);
    expect(updatedNotification!.snoozedUntil).toBeDefined();
  });

  it("works without notificationId", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId });

    const { request, params } = createRequest(task._id.toString());
    const res = await POST(request, { params });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
