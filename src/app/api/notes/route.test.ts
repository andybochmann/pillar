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
  createTestNote,
  createTestProjectMember,
} from "@/test/helpers";
import { GET, POST } from "./route";

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

describe("GET /api/notes", () => {
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
    const user = await createTestUser({ email: "test@example.com" });
    session.user.id = user._id.toString();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      categoryId: category._id,
      userId: user._id,
    });
    const task = await createTestTask({
      projectId: project._id,
      userId: user._id,
    });
    return { user, category, project, task };
  }

  it("returns 401 for unauthenticated requests", async () => {
    const original = session.user.id;
    session.user.id = "";
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/notes?categoryId=abc");
    const res = await GET(req);
    expect(res.status).toBe(401);

    session.user.id = original;
  });

  it("returns 400 without query params", async () => {
    await setupFixtures();
    const req = new NextRequest("http://localhost/api/notes");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns category notes", async () => {
    const { user, category } = await setupFixtures();
    await createTestNote({
      parentType: "category",
      categoryId: category._id,
      userId: user._id,
      title: "Cat Note",
    });

    const req = new NextRequest(
      `http://localhost/api/notes?categoryId=${category._id}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Cat Note");
  });

  it("returns project notes", async () => {
    const { user, project } = await setupFixtures();
    await createTestNote({
      parentType: "project",
      projectId: project._id,
      userId: user._id,
      title: "Proj Note",
    });

    const req = new NextRequest(
      `http://localhost/api/notes?projectId=${project._id}&parentType=project`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Proj Note");
  });

  it("returns task notes", async () => {
    const { user, project, task } = await setupFixtures();
    await createTestNote({
      parentType: "task",
      projectId: project._id,
      taskId: task._id,
      userId: user._id,
      title: "Task Note",
    });

    const req = new NextRequest(
      `http://localhost/api/notes?taskId=${task._id}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Task Note");
  });

  it("returns 404 for non-existent category", async () => {
    await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId();
    const req = new NextRequest(
      `http://localhost/api/notes?categoryId=${fakeId}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("sorts pinned notes first", async () => {
    const { user, category } = await setupFixtures();
    await createTestNote({
      parentType: "category",
      categoryId: category._id,
      userId: user._id,
      title: "Unpinned",
      pinned: false,
      order: 0,
    });
    await createTestNote({
      parentType: "category",
      categoryId: category._id,
      userId: user._id,
      title: "Pinned",
      pinned: true,
      order: 1,
    });

    const req = new NextRequest(
      `http://localhost/api/notes?categoryId=${category._id}`,
    );
    const res = await GET(req);
    const data = await res.json();
    expect(data[0].title).toBe("Pinned");
    expect(data[1].title).toBe("Unpinned");
  });
});

describe("POST /api/notes", () => {
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
    const user = await createTestUser({ email: "test@example.com" });
    session.user.id = user._id.toString();
    const category = await createTestCategory({ userId: user._id });
    const project = await createTestProject({
      categoryId: category._id,
      userId: user._id,
    });
    const task = await createTestTask({
      projectId: project._id,
      userId: user._id,
    });
    return { user, category, project, task };
  }

  function createRequest(body: unknown) {
    return new NextRequest("http://localhost/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a category note", async () => {
    const { category } = await setupFixtures();
    const req = createRequest({
      title: "My Note",
      content: "Hello world",
      parentType: "category",
      categoryId: category._id.toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("My Note");
    expect(data.content).toBe("Hello world");
    expect(data.parentType).toBe("category");
  });

  it("creates a project note", async () => {
    const { project } = await setupFixtures();
    const req = createRequest({
      title: "Architecture",
      parentType: "project",
      projectId: project._id.toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.parentType).toBe("project");
  });

  it("creates a task note", async () => {
    const { task } = await setupFixtures();
    const req = createRequest({
      title: "Task notes",
      parentType: "task",
      taskId: task._id.toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.parentType).toBe("task");
    expect(data.taskId).toBe(task._id.toString());
  });

  it("returns 400 for missing title", async () => {
    const { category } = await setupFixtures();
    const req = createRequest({
      parentType: "category",
      categoryId: category._id.toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for category note without categoryId", async () => {
    await setupFixtures();
    const req = createRequest({
      title: "Test",
      parentType: "category",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent category", async () => {
    await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId();
    const req = createRequest({
      title: "Test",
      parentType: "category",
      categoryId: fakeId.toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 for viewers on project notes", async () => {
    const { project } = await setupFixtures();

    // Create another user who is a viewer
    const viewer = await createTestUser({ email: "viewer@example.com" });
    await createTestProjectMember({
      projectId: project._id,
      userId: viewer._id,
      role: "viewer",
      invitedBy: new mongoose.Types.ObjectId(session.user.id),
    });
    session.user.id = viewer._id.toString();

    const req = createRequest({
      title: "Viewer note",
      parentType: "project",
      projectId: project._id.toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
