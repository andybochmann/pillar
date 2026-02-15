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

vi.mock("@/lib/ai", () => ({
  isAIEnabled: vi.fn(() => true),
  isAIAllowedForUser: vi.fn(() => true),
  getAIModel: vi.fn(() => "mock-model"),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { isAIEnabled, isAIAllowedForUser } from "@/lib/ai";
import { generateObject } from "ai";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ai/generate-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setupFixtures() {
  const user = await createTestUser();
  session.user.id = user._id.toString();
  const category = await createTestCategory({ userId: user._id });
  const project = await createTestProject({
    name: "E-Commerce App",
    description: "Online store with cart and checkout",
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

describe("POST /api/ai/generate-tasks", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(() => {
    vi.mocked(isAIEnabled).mockReturnValue(true);
    vi.mocked(isAIAllowedForUser).mockReturnValue(true);
    vi.mocked(auth).mockResolvedValue(session);
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ projectId: "abc" }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when AI is not enabled", async () => {
    vi.mocked(isAIEnabled).mockReturnValue(false);
    const res = await POST(makeRequest({ projectId: "abc" }));
    expect(res.status).toBe(503);
  });

  it("returns 403 when user is not whitelisted", async () => {
    vi.mocked(isAIAllowedForUser).mockReturnValue(false);
    const res = await POST(makeRequest({ projectId: "abc" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("not available");
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when maxCount exceeds 20", async () => {
    const res = await POST(makeRequest({ projectId: "abc", maxCount: 25 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when project does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await POST(makeRequest({ projectId: fakeId }));
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
      makeRequest({ projectId: project._id.toString() }),
    );
    expect(res.status).toBe(403);
  });

  it("generates tasks successfully", async () => {
    const { project } = await setupFixtures();

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        tasks: [
          {
            title: "Set up product catalog",
            description: "Create product listing page",
            priority: "high",
            subtasks: ["Design schema", "Build API"],
          },
          {
            title: "Implement checkout flow",
            description: "Build the checkout process",
            priority: "medium",
            subtasks: [],
          },
        ],
      },
    } as never);

    const res = await POST(
      makeRequest({ projectId: project._id.toString() }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0].title).toBe("Set up product catalog");
    expect(data.tasks[0].columnId).toBe("todo");
    expect(data.tasks[0].subtasks).toEqual(["Design schema", "Build API"]);
    expect(data.tasks[1].columnId).toBe("todo");
  });

  it("includes existing task titles in prompt for dedup", async () => {
    const { project, user } = await setupFixtures();
    await createTestTask({
      title: "Existing task",
      projectId: project._id,
      userId: user._id,
    });

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { tasks: [] },
    } as never);

    await POST(makeRequest({ projectId: project._id.toString() }));

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Existing task"),
      }),
    );
  });

  it("always assigns first column to generated tasks", async () => {
    const { project } = await setupFixtures();

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        tasks: [
          {
            title: "Generated task",
            description: "A task",
            priority: "medium",
            subtasks: [],
          },
        ],
      },
    } as never);

    const res = await POST(
      makeRequest({ projectId: project._id.toString() }),
    );
    const data = await res.json();

    expect(data.tasks[0].columnId).toBe("todo");
  });

  it("includes context in prompt when provided", async () => {
    const { project } = await setupFixtures();

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { tasks: [] },
    } as never);

    await POST(
      makeRequest({
        projectId: project._id.toString(),
        context: "Focus on payment integration",
      }),
    );

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Focus on payment integration"),
      }),
    );
  });

  it("respects maxCount parameter", async () => {
    const { project } = await setupFixtures();

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { tasks: [] },
    } as never);

    await POST(
      makeRequest({ projectId: project._id.toString(), maxCount: 3 }),
    );

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("3 tasks"),
      }),
    );
  });

  it("returns 500 when AI generation fails", async () => {
    const { project } = await setupFixtures();

    vi.mocked(generateObject).mockRejectedValueOnce(
      new Error("API error"),
    );

    const res = await POST(
      makeRequest({ projectId: project._id.toString() }),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Failed to generate");
  });
});
