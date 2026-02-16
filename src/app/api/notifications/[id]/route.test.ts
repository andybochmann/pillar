import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { Notification } from "@/models/notification";
import { setupTestDB, teardownTestDB } from "@/test/helpers/db";
import { createTestUser, createTestTask, createTestProject, createTestCategory } from "@/test/helpers/factories";

// vi.hoisted() for session — must exist before vi.mock() closures
const session = vi.hoisted(() => ({
  user: { id: "", name: "Test User", email: "test@example.com" },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

// Mock connectDB and auth
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

// Import handlers after mocks
import { GET, PATCH, DELETE } from "./route";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await Notification.deleteMany({});
  await mongoose.connection.db?.collection("tasks").deleteMany({});
  await mongoose.connection.db?.collection("projects").deleteMany({});
  await mongoose.connection.db?.collection("categories").deleteMany({});
  await mongoose.connection.db?.collection("users").deleteMany({});
  vi.clearAllMocks();
});

describe("GET /api/notifications/[id]", () => {
  it("returns 401 if not authenticated", async () => {
    vi.mocked(await import("@/lib/auth")).auth.mockResolvedValueOnce(null);
    const request = new Request("http://localhost:3000/api/notifications/123");
    const params = Promise.resolve({ id: "123" });
    const response = await GET(request, { params });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 if notification not found", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const fakeId = new mongoose.Types.ObjectId().toString();
    const request = new Request(`http://localhost:3000/api/notifications/${fakeId}`);
    const params = Promise.resolve({ id: fakeId });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Notification not found");
  });

  it("returns 404 if notification belongs to another user", async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: otherUser._id });
    const project = await createTestProject({ userId: otherUser._id, categoryId: category._id });
    const task = await createTestTask({ userId: otherUser._id, projectId: project._id });

    const notification = await Notification.create({
      userId: otherUser._id,
      taskId: task._id,
      type: "reminder",
      title: "Other user notification",
      message: "Should not be accessible",
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`);
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Notification not found");
  });

  it("returns the notification successfully", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test notification",
      message: "Test message",
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`);
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data._id.toString()).toBe(notification._id.toString());
    expect(data.title).toBe("Test notification");
    expect(data.message).toBe("Test message");
  });
});

describe("PATCH /api/notifications/[id]", () => {
  it("returns 401 if not authenticated", async () => {
    vi.mocked(await import("@/lib/auth")).auth.mockResolvedValueOnce(null);
    const request = new Request("http://localhost:3000/api/notifications/123", {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    });
    const params = Promise.resolve({ id: "123" });
    const response = await PATCH(request, { params });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid data", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test",
      message: "Test",
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "PATCH",
      body: JSON.stringify({ read: "not-a-boolean" }),
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns 404 if notification not found", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const fakeId = new mongoose.Types.ObjectId().toString();
    const request = new Request(`http://localhost:3000/api/notifications/${fakeId}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    });
    const params = Promise.resolve({ id: fakeId });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Notification not found");
  });

  it("returns 404 if notification belongs to another user", async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: otherUser._id });
    const project = await createTestProject({ userId: otherUser._id, categoryId: category._id });
    const task = await createTestTask({ userId: otherUser._id, projectId: project._id });

    const notification = await Notification.create({
      userId: otherUser._id,
      taskId: task._id,
      type: "reminder",
      title: "Other user notification",
      message: "Should not be accessible",
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Notification not found");
  });

  it("updates read status successfully", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test",
      message: "Test",
      read: false,
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.read).toBe(true);
  });

  it("updates dismissed status successfully", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test",
      message: "Test",
      dismissed: false,
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "PATCH",
      body: JSON.stringify({ dismissed: true }),
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dismissed).toBe(true);
  });

  it("updates snoozedUntil successfully", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test",
      message: "Test",
    });

    const snoozedUntil = new Date(Date.now() + 3600000);
    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "PATCH",
      body: JSON.stringify({ snoozedUntil: snoozedUntil.toISOString() }),
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.snoozedUntil).toBeDefined();
    expect(new Date(data.snoozedUntil).getTime()).toBeCloseTo(snoozedUntil.getTime(), -2);
  });

  it("clears snoozedUntil when set to null", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test",
      message: "Test",
      snoozedUntil: new Date(),
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "PATCH",
      body: JSON.stringify({ snoozedUntil: null }),
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.snoozedUntil).toBeNull();
  });

  it("updates multiple fields simultaneously", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test",
      message: "Test",
      read: false,
      dismissed: false,
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true, dismissed: true }),
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.read).toBe(true);
    expect(data.dismissed).toBe(true);
  });
});

describe("DELETE /api/notifications/[id]", () => {
  it("returns 401 if not authenticated", async () => {
    vi.mocked(await import("@/lib/auth")).auth.mockResolvedValueOnce(null);
    const request = new Request("http://localhost:3000/api/notifications/123", {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: "123" });
    const response = await DELETE(request, { params });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 if notification not found", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const fakeId = new mongoose.Types.ObjectId().toString();
    const request = new Request(`http://localhost:3000/api/notifications/${fakeId}`, {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: fakeId });
    const response = await DELETE(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Notification not found");
  });

  it("returns 404 if notification belongs to another user", async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: otherUser._id });
    const project = await createTestProject({ userId: otherUser._id, categoryId: category._id });
    const task = await createTestTask({ userId: otherUser._id, projectId: project._id });

    const notification = await Notification.create({
      userId: otherUser._id,
      taskId: task._id,
      type: "reminder",
      title: "Other user notification",
      message: "Should not be accessible",
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await DELETE(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Notification not found");
  });

  it("deletes the notification successfully", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Test",
      message: "Test",
    });

    const request = new Request(`http://localhost:3000/api/notifications/${notification._id}`, {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: notification._id.toString() });
    const response = await DELETE(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify notification is actually deleted
    const deletedNotification = await Notification.findById(notification._id);
    expect(deletedNotification).toBeNull();
  });
});
