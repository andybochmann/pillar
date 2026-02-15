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
  createTestLabel,
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

describe("GET /api/tasks", () => {
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
    const user = await createTestUser({
      email: "test@example.com",
    });
    userId = user._id as mongoose.Types.ObjectId;
    // Override session user id to match the created user
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
    });
    projectId = project._id as mongoose.Types.ObjectId;
    return { user, category, project };
  }

  function createRequest(params: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/tasks");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new NextRequest(url);
  }

  it("returns tasks filtered by projectId", async () => {
    await setupFixtures();
    await createTestTask({ projectId, userId, title: "Task 1" });
    await createTestTask({ projectId, userId, title: "Task 2" });

    const res = await GET(createRequest({ projectId: projectId.toString() }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by priority", async () => {
    await setupFixtures();
    await createTestTask({ projectId, userId, priority: "urgent" });
    await createTestTask({ projectId, userId, priority: "low" });
    await createTestTask({ projectId, userId, priority: "urgent" });

    const res = await GET(createRequest({ priority: "urgent" }));
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(
      data.every((t: { priority: string }) => t.priority === "urgent"),
    ).toBe(true);
  });

  it("filters by multiple priorities", async () => {
    await setupFixtures();
    await createTestTask({ projectId, userId, priority: "urgent" });
    await createTestTask({ projectId, userId, priority: "low" });
    await createTestTask({ projectId, userId, priority: "high" });

    const res = await GET(createRequest({ priority: "urgent,high" }));
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by due date range", async () => {
    await setupFixtures();
    await createTestTask({
      projectId,
      userId,
      title: "Past",
      dueDate: new Date(2025, 0, 1),
    });
    await createTestTask({
      projectId,
      userId,
      title: "InRange",
      dueDate: new Date(2025, 5, 15),
    });
    await createTestTask({
      projectId,
      userId,
      title: "Future",
      dueDate: new Date(2026, 0, 1),
    });

    const res = await GET(
      createRequest({
        dueDateFrom: "2025-06-01",
        dueDateTo: "2025-06-30",
      }),
    );
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("InRange");
  });

  it("filters by labels", async () => {
    await setupFixtures();
    const bugLabel = await createTestLabel({ userId, name: "bug" });
    const frontendLabel = await createTestLabel({
      userId,
      name: "frontend",
      color: "#3b82f6",
    });
    await createTestTask({
      projectId,
      userId,
      title: "Tagged",
      labels: [bugLabel._id, frontendLabel._id],
    });
    await createTestTask({
      projectId,
      userId,
      title: "Untagged",
      labels: [],
    });

    const res = await GET(
      createRequest({ labels: bugLabel._id.toString() }),
    );
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Tagged");
  });

  it("filters by completion status — completed", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId, title: "Done" });
    task.completedAt = new Date();
    await task.save();
    await createTestTask({ projectId, userId, title: "Open" });

    const res = await GET(createRequest({ completed: "true" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Done");
  });

  it("filters by completion status — incomplete", async () => {
    await setupFixtures();
    const task = await createTestTask({ projectId, userId, title: "Done" });
    task.completedAt = new Date();
    await task.save();
    await createTestTask({ projectId, userId, title: "Open" });

    const res = await GET(createRequest({ completed: "false" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Open");
  });

  it("sorts by dueDate ascending", async () => {
    await setupFixtures();
    await createTestTask({
      projectId,
      userId,
      title: "Later",
      dueDate: new Date("2025-12-01"),
    });
    await createTestTask({
      projectId,
      userId,
      title: "Sooner",
      dueDate: new Date("2025-06-01"),
    });

    const res = await GET(createRequest({ sortBy: "dueDate" }));
    const data = await res.json();
    expect(data[0].title).toBe("Sooner");
    expect(data[1].title).toBe("Later");
  });

  it("sorts by priority ascending", async () => {
    await setupFixtures();
    await createTestTask({ projectId, userId, title: "Low", priority: "low" });
    await createTestTask({
      projectId,
      userId,
      title: "Urgent",
      priority: "urgent",
    });
    await createTestTask({
      projectId,
      userId,
      title: "Medium",
      priority: "medium",
    });

    const res = await GET(createRequest({ sortBy: "priority" }));
    const data = await res.json();
    expect(data[0].title).toBe("Urgent");
    expect(data[1].title).toBe("Medium");
    expect(data[2].title).toBe("Low");
  });

  it("returns 401 for unauthenticated request", async () => {
    // Re-mock auth to return null
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it("searches tasks by title", async () => {
    await setupFixtures();
    await createTestTask({ projectId, userId, title: "Fix login bug" });
    await createTestTask({ projectId, userId, title: "Add dark mode" });
    await createTestTask({ projectId, userId, title: "Fix signup flow" });

    const res = await GET(createRequest({ search: "fix" }));
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.map((t: { title: string }) => t.title)).toContain(
      "Fix login bug",
    );
    expect(data.map((t: { title: string }) => t.title)).toContain(
      "Fix signup flow",
    );
  });

  it("search is case-insensitive", async () => {
    await setupFixtures();
    await createTestTask({ projectId, userId, title: "Login BUG" });

    const res = await GET(createRequest({ search: "login" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Login BUG");
  });
});

describe("POST /api/tasks", () => {
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
    const user = await createTestUser({ email: "post@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id as mongoose.Types.ObjectId,
      userId,
    });
    projectId = project._id as mongoose.Types.ObjectId;
  }

  function createRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a task successfully", async () => {
    await setupFixtures();
    const res = await POST(
      createRequest({
        title: "New Task",
        projectId: projectId.toString(),
        columnId: "todo",
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("New Task");
    expect(data.columnId).toBe("todo");
    expect(data.priority).toBe("medium");
    expect(data.order).toBe(0);
  });

  it("returns 400 for missing title", async () => {
    await setupFixtures();
    const res = await POST(
      createRequest({
        projectId: projectId.toString(),
        columnId: "todo",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a task with subtasks", async () => {
    await setupFixtures();
    const res = await POST(
      createRequest({
        title: "Task with subtasks",
        projectId: projectId.toString(),
        columnId: "todo",
        subtasks: [
          { title: "Step 1" },
          { title: "Step 2", completed: true },
        ],
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.subtasks).toHaveLength(2);
    expect(data.subtasks[0].title).toBe("Step 1");
    expect(data.subtasks[0].completed).toBe(false);
    expect(data.subtasks[1].title).toBe("Step 2");
    expect(data.subtasks[1].completed).toBe(true);
  });

  it("seeds statusHistory with initial column on creation", async () => {
    await setupFixtures();
    const res = await POST(
      createRequest({
        title: "History Task",
        projectId: projectId.toString(),
        columnId: "todo",
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.statusHistory).toHaveLength(1);
    expect(data.statusHistory[0].columnId).toBe("todo");
    expect(data.statusHistory[0].timestamp).toBeDefined();
  });

  it("returns 403 when viewer tries to create a task", async () => {
    await setupFixtures();
    const viewer = await createTestUser({ email: "viewer@example.com" });
    await createTestProjectMember({
      projectId,
      userId: viewer._id as mongoose.Types.ObjectId,
      role: "viewer",
      invitedBy: userId,
    });
    session.user.id = viewer._id.toString();

    const res = await POST(
      createRequest({
        title: "Should fail",
        projectId: projectId.toString(),
        columnId: "todo",
      }),
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Viewers cannot create tasks");

    // Restore session
    session.user.id = userId.toString();
  });

  it("auto-increments order", async () => {
    await setupFixtures();
    await createTestTask({ projectId, userId, columnId: "todo", order: 0 });

    const res = await POST(
      createRequest({
        title: "Second Task",
        projectId: projectId.toString(),
        columnId: "todo",
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.order).toBe(1);
  });
});
