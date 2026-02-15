import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
} from "@/test/helpers/db";
import {
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
  createTestProjectMember,
} from "@/test/helpers/factories";
import { emitSyncEvent } from "@/lib/event-bus";

const session = vi.hoisted(() => ({
  user: {
    id: "000000000000000000000000",
    name: "Test User",
    email: "test@example.com",
  },
  expires: "2099-01-01",
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/event-bus", () => ({
  emitSyncEvent: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { Task } from "@/models/task";

function makeRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return new Request("http://localhost/api/tasks/bulk-create", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function setupFixtures() {
  const user = await createTestUser();
  session.user.id = user._id.toString();
  const category = await createTestCategory({ userId: user._id });
  const project = await createTestProject({
    categoryId: category._id,
    userId: user._id,
  });
  await createTestProjectMember({
    projectId: project._id,
    userId: user._id,
    role: "owner",
    invitedBy: user._id,
  });
  return { user, category, project };
}

describe("POST /api/tasks/bulk-create", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(emitSyncEvent).mockClear();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const res = await POST(
      makeRequest({
        projectId: "abc",
        tasks: [{ title: "T", columnId: "todo" }],
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tasks array is empty", async () => {
    const res = await POST(
      makeRequest({ projectId: "abc", tasks: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when tasks exceed 20", async () => {
    const tasks = Array.from({ length: 21 }, (_, i) => ({
      title: `Task ${i}`,
      columnId: "todo",
    }));
    const res = await POST(makeRequest({ projectId: "abc", tasks }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when project does not exist", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await POST(
      makeRequest({
        projectId: fakeId,
        tasks: [{ title: "T", columnId: "todo" }],
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is a viewer", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const viewer = await createTestUser({ email: "viewer@test.com" });
    session.user.id = viewer._id.toString();
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      categoryId: category._id,
      userId: owner._id,
    });
    await createTestProjectMember({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });
    await createTestProjectMember({
      projectId: project._id,
      userId: viewer._id,
      role: "viewer",
      invitedBy: owner._id,
    });

    const res = await POST(
      makeRequest({
        projectId: project._id.toString(),
        tasks: [{ title: "T", columnId: "todo" }],
      }),
    );
    expect(res.status).toBe(403);
  });

  it("creates tasks with correct orders", async () => {
    const { project, user } = await setupFixtures();

    // Add an existing task in the "todo" column
    await createTestTask({
      projectId: project._id,
      userId: user._id,
      columnId: "todo",
      order: 0,
    });

    const res = await POST(
      makeRequest({
        projectId: project._id.toString(),
        tasks: [
          { title: "Task A", columnId: "todo" },
          { title: "Task B", columnId: "todo" },
          { title: "Task C", columnId: "in-progress" },
        ],
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tasks).toHaveLength(3);

    // todo column: existing order 0, new tasks get 1 and 2
    expect(data.tasks[0].order).toBe(1);
    expect(data.tasks[1].order).toBe(2);
    // in-progress column: no existing tasks, starts at 0
    expect(data.tasks[2].order).toBe(0);
  });

  it("creates tasks with subtasks", async () => {
    const { project } = await setupFixtures();

    const res = await POST(
      makeRequest({
        projectId: project._id.toString(),
        tasks: [
          {
            title: "Task with subs",
            columnId: "todo",
            subtasks: [
              { title: "Sub 1", completed: false },
              { title: "Sub 2" },
            ],
          },
        ],
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tasks[0].subtasks).toHaveLength(2);
    expect(data.tasks[0].subtasks[0].title).toBe("Sub 1");
    expect(data.tasks[0].subtasks[0].completed).toBe(false);
  });

  it("initializes statusHistory for each task", async () => {
    const { project } = await setupFixtures();

    const res = await POST(
      makeRequest({
        projectId: project._id.toString(),
        tasks: [{ title: "Task", columnId: "review" }],
      }),
    );

    const data = await res.json();
    expect(data.tasks[0].statusHistory).toHaveLength(1);
    expect(data.tasks[0].statusHistory[0].columnId).toBe("review");
  });

  it("emits sync events for each created task", async () => {
    const { project } = await setupFixtures();

    await POST(
      makeRequest({
        projectId: project._id.toString(),
        tasks: [
          { title: "T1", columnId: "todo" },
          { title: "T2", columnId: "todo" },
        ],
      }),
    );

    expect(emitSyncEvent).toHaveBeenCalledTimes(2);
    expect(emitSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "task",
        action: "created",
        projectId: project._id.toString(),
      }),
    );
  });

  it("passes X-Session-Id header to sync events", async () => {
    const { project } = await setupFixtures();

    await POST(
      makeRequest(
        {
          projectId: project._id.toString(),
          tasks: [{ title: "T1", columnId: "todo" }],
        },
        { "X-Session-Id": "test-session-123" },
      ),
    );

    expect(emitSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "test-session-123",
      }),
    );
  });

  it("defaults priority to medium", async () => {
    const { project } = await setupFixtures();

    const res = await POST(
      makeRequest({
        projectId: project._id.toString(),
        tasks: [{ title: "No priority", columnId: "todo" }],
      }),
    );

    const data = await res.json();
    expect(data.tasks[0].priority).toBe("medium");
  });
});
