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

describe("GET /api/search", () => {
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
      name: "My Project",
      categoryId: category._id as mongoose.Types.ObjectId,
      userId: user._id,
    });
    await createTestProjectMember({
      projectId: project._id as mongoose.Types.ObjectId,
      userId: user._id,
      role: "owner",
      invitedBy: user._id,
    });

    return { user, category, project };
  }

  function createRequest(params: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/search");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new NextRequest(url);
  }

  it("returns 401 for unauthenticated requests", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const req = createRequest({ q: "test" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when query param q is missing", async () => {
    const { GET } = await import("./route");
    const req = createRequest({});
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Search query is required");
  });

  it("returns 400 when query param q is empty", async () => {
    const { GET } = await import("./route");
    const req = createRequest({ q: "   " });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns matching tasks from text search", async () => {
    const { project } = await setupFixtures();

    await createTestTask({
      title: "Fix login bug",
      description: "Users cannot login",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "todo",
    });
    await createTestTask({
      title: "Add dashboard",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "todo",
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "login" });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe("Fix login bug");
    expect(body.tasks[0].projectName).toBe("My Project");
  });

  it("returns matching notes from text search", async () => {
    const { project, category } = await setupFixtures();

    await createTestNote({
      title: "Architecture decisions",
      content: "We decided to use MongoDB for storage",
      parentType: "project",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });
    await createTestNote({
      title: "Meeting notes",
      content: "Discussed the roadmap",
      parentType: "category",
      categoryId: category._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "MongoDB" });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].title).toBe("Architecture decisions");
    expect(body.notes[0].parentName).toBe("My Project");
  });

  it("returns both tasks and notes when matching", async () => {
    const { project } = await setupFixtures();

    await createTestTask({
      title: "Implement search feature",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "todo",
    });
    await createTestNote({
      title: "Search feature spec",
      content: "The search should be fast",
      parentType: "project",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "search" });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tasks.length).toBeGreaterThanOrEqual(1);
    expect(body.notes.length).toBeGreaterThanOrEqual(1);
  });

  it("excludes archived tasks by default", async () => {
    const { project } = await setupFixtures();

    await createTestTask({
      title: "Archived task about widgets",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "done",
      archived: true,
      archivedAt: new Date(),
    });
    await createTestTask({
      title: "Active task about widgets",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "todo",
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "widgets" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe("Active task about widgets");
    expect(body.archivedTasks).toHaveLength(0);
  });

  it("includes archived tasks when includeArchived=true", async () => {
    const { project } = await setupFixtures();

    await createTestTask({
      title: "Archived task about gadgets",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "done",
      archived: true,
      archivedAt: new Date(),
    });
    await createTestTask({
      title: "Active task about gadgets",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "todo",
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "gadgets", includeArchived: "true" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe("Active task about gadgets");
    expect(body.archivedTasks).toHaveLength(1);
    expect(body.archivedTasks[0].title).toBe("Archived task about gadgets");
  });

  it("does not return tasks from inaccessible projects", async () => {
    await setupFixtures();

    // Create another user with their own project
    const otherUser = await createTestUser({ email: "other@example.com" });
    const otherCategory = await createTestCategory({ userId: otherUser._id });
    const otherProject = await createTestProject({
      name: "Other Project",
      categoryId: otherCategory._id as mongoose.Types.ObjectId,
      userId: otherUser._id,
    });
    await createTestProjectMember({
      projectId: otherProject._id as mongoose.Types.ObjectId,
      userId: otherUser._id,
      role: "owner",
      invitedBy: otherUser._id,
    });
    await createTestTask({
      title: "Secret private task",
      projectId: otherProject._id as mongoose.Types.ObjectId,
      userId: otherUser._id,
      columnId: "todo",
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "secret" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.tasks).toHaveLength(0);
    expect(body.archivedTasks).toHaveLength(0);
  });

  it("returns note parentName for category notes", async () => {
    const { category } = await setupFixtures();

    await createTestNote({
      title: "Category planning note",
      content: "Plan for Q1",
      parentType: "category",
      categoryId: category._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "planning" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].parentName).toBe("Test Category");
  });

  it("returns note parentName for task notes", async () => {
    const { project } = await setupFixtures();
    const task = await createTestTask({
      title: "Design homepage",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
      columnId: "todo",
    });

    await createTestNote({
      title: "Homepage requirements doc",
      content: "The homepage needs a hero section",
      parentType: "task",
      projectId: project._id as mongoose.Types.ObjectId,
      taskId: task._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "requirements" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].parentName).toBe("Design homepage");
  });

  it("returns empty results when nothing matches", async () => {
    await setupFixtures();

    const { GET } = await import("./route");
    const req = createRequest({ q: "nonexistentquery12345" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.tasks).toHaveLength(0);
    expect(body.notes).toHaveLength(0);
    expect(body.archivedTasks).toHaveLength(0);
  });

  it("limits results to 20 per type", async () => {
    const { project } = await setupFixtures();

    // Create 25 tasks
    const taskPromises = Array.from({ length: 25 }, (_, i) =>
      createTestTask({
        title: `Bulk test item number ${i}`,
        projectId: project._id as mongoose.Types.ObjectId,
        userId: new mongoose.Types.ObjectId(session.user.id),
        columnId: "todo",
        order: i,
      }),
    );
    await Promise.all(taskPromises);

    const { GET } = await import("./route");
    const req = createRequest({ q: "bulk" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.tasks.length).toBeLessThanOrEqual(20);
  });

  it("returns 400 when query exceeds max length", async () => {
    await setupFixtures();
    const longQuery = "a".repeat(201);

    const { GET } = await import("./route");
    const req = createRequest({ q: longQuery });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/200 characters/);
  });

  it("strips full content from note results", async () => {
    const { project } = await setupFixtures();

    const longContent = "x".repeat(1000);
    await createTestNote({
      title: "Stripped content note",
      content: longContent,
      parentType: "project",
      projectId: project._id as mongoose.Types.ObjectId,
      userId: new mongoose.Types.ObjectId(session.user.id),
    });

    const { GET } = await import("./route");
    const req = createRequest({ q: "stripped" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].snippet).toHaveLength(103); // 100 chars + "..."
    expect(body.notes[0].content).toBeUndefined();
  });
});
