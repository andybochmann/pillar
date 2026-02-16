import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Notification } from "@/models/notification";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers";
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
import { GET, POST } from "./route";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await clearTestDB();
  vi.clearAllMocks();
});

describe("GET /api/notifications", () => {

  it("returns 401 if not authenticated", async () => {
    vi.mocked(await import("@/lib/auth")).auth.mockResolvedValueOnce(null);
    const request = new Request("http://localhost:3000/api/notifications");
    const response = await GET(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns all notifications for the authenticated user", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notification1 = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Task due soon",
      message: "Your task is due in 1 hour",
    });

    const notification2 = await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "overdue",
      title: "Task overdue",
      message: "Your task is overdue",
    });

    // Other user's notification
    const otherUser = await createTestUser();
    await Notification.create({
      userId: otherUser._id,
      taskId: task._id,
      type: "reminder",
      title: "Other user notification",
      message: "Should not appear",
    });

    const request = new Request("http://localhost:3000/api/notifications");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(2);
    expect(data[0]._id.toString()).toBe(notification2._id.toString());
    expect(data[1]._id.toString()).toBe(notification1._id.toString());
  });

  it("filters notifications by read status", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Unread notification",
      message: "Unread",
      read: false,
    });

    await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "overdue",
      title: "Read notification",
      message: "Read",
      read: true,
    });

    const request = new Request("http://localhost:3000/api/notifications?read=false");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Unread notification");
  });

  it("filters notifications by dismissed status", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Active notification",
      message: "Active",
      dismissed: false,
    });

    await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "overdue",
      title: "Dismissed notification",
      message: "Dismissed",
      dismissed: true,
    });

    const request = new Request("http://localhost:3000/api/notifications?dismissed=false");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Active notification");
  });

  it("filters notifications by type", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Reminder 1",
      message: "Reminder message",
    });

    await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "overdue",
      title: "Overdue",
      message: "Overdue message",
    });

    await Notification.create({
      userId: user._id,
      taskId: task._id,
      type: "reminder",
      title: "Reminder 2",
      message: "Reminder message 2",
    });

    // Filter by single type — should return only the 1 overdue
    const request = new Request("http://localhost:3000/api/notifications?type=overdue");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("overdue");
  });

  it("filters notifications by taskId", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task1 = await createTestTask({ userId: user._id, projectId: project._id });
    const task2 = await createTestTask({ userId: user._id, projectId: project._id });

    await Notification.create({
      userId: user._id,
      taskId: task1._id,
      type: "reminder",
      title: "Task 1 notification",
      message: "Message",
    });

    await Notification.create({
      userId: user._id,
      taskId: task2._id,
      type: "overdue",
      title: "Task 2 notification",
      message: "Message",
    });

    const request = new Request(`http://localhost:3000/api/notifications?taskId=${task1._id.toString()}`);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Task 1 notification");
  });

  it("limits results when limit parameter is provided", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    // Create 5 notifications
    for (let i = 0; i < 5; i++) {
      await Notification.create({
        userId: user._id,
        taskId: task._id,
        type: "reminder",
        title: `Notification ${i}`,
        message: "Message",
      });
    }

    const request = new Request("http://localhost:3000/api/notifications?limit=3");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(3);
  });
});

describe("POST /api/notifications", () => {
  it("returns 401 if not authenticated", async () => {
    vi.mocked(await import("@/lib/auth")).auth.mockResolvedValueOnce(null);
    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 if required fields are missing", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("creates a notification successfully", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notificationData = {
      taskId: task._id.toString(),
      type: "reminder",
      title: "Task due soon",
      message: "Your task is due in 1 hour",
    };

    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      body: JSON.stringify(notificationData),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.title).toBe(notificationData.title);
    expect(data.message).toBe(notificationData.message);
    expect(data.type).toBe(notificationData.type);
    expect(data.userId.toString()).toBe(user._id.toString());
    expect(data.taskId.toString()).toBe(task._id.toString());
    expect(data.read).toBe(false);
    expect(data.dismissed).toBe(false);
  });

  it("validates notification type", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notificationData = {
      taskId: task._id.toString(),
      type: "invalid-type",
      title: "Test",
      message: "Test message",
    };

    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      body: JSON.stringify(notificationData),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("validates title length", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notificationData = {
      taskId: task._id.toString(),
      type: "reminder",
      title: "a".repeat(201),
      message: "Test message",
    };

    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      body: JSON.stringify(notificationData),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("validates message length", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const notificationData = {
      taskId: task._id.toString(),
      type: "reminder",
      title: "Test",
      message: "a".repeat(501),
    };

    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      body: JSON.stringify(notificationData),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("creates notification with optional fields", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({ userId: user._id, categoryId: category._id });
    const task = await createTestTask({ userId: user._id, projectId: project._id });

    const scheduledFor = new Date(Date.now() + 3600000);
    const snoozedUntil = new Date(Date.now() + 1800000);

    const notificationData = {
      taskId: task._id.toString(),
      type: "reminder",
      title: "Reminder",
      message: "Don't forget",
      scheduledFor: scheduledFor.toISOString(),
      snoozedUntil: snoozedUntil.toISOString(),
      metadata: { priority: "high", custom: "data" },
    };

    const request = new Request("http://localhost:3000/api/notifications", {
      method: "POST",
      body: JSON.stringify(notificationData),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.scheduledFor).toBeDefined();
    expect(data.snoozedUntil).toBeDefined();
    expect(data.metadata).toEqual({ priority: "high", custom: "data" });
  });
});
