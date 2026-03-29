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
import { Task } from "@/models/task";
import { registerTaskTools } from "./tasks";

// Mock event bus to prevent SSE emissions during tests
vi.mock("@/lib/event-bus", () => ({
  emitSyncEvent: vi.fn(),
}));

// Mock reminder-scheduler
vi.mock("@/lib/reminder-scheduler", () => ({
  scheduleNextReminder: vi.fn().mockResolvedValue(undefined),
}));

// We need to mock getMcpUserId to return a test user ID
const mockUserId = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/mcp-server", () => ({
  getMcpUserId: () => mockUserId.value,
}));

/**
 * Minimal fake McpServer that captures tool registrations and lets us call them.
 */
function createFakeMcpServer() {
  const tools = new Map<string, { handler: (args: Record<string, unknown>) => Promise<unknown> }>();

  return {
    tool(
      name: string,
      _description: string,
      _schema: unknown,
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) {
      tools.set(name, { handler });
    },
    async callTool(name: string, args: Record<string, unknown> = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool ${name} not registered`);
      return tool.handler(args);
    },
  };
}

describe("MCP update_task", () => {
  let userId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;
  let server: ReturnType<typeof createFakeMcpServer>;

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
    const user = await createTestUser();
    userId = user._id as mongoose.Types.ObjectId;
    mockUserId.value = userId.toString();

    const category = await createTestCategory({ userId });
    const categoryId = category._id as mongoose.Types.ObjectId;

    const project = await createTestProject({ categoryId, userId });
    projectId = project._id as mongoose.Types.ObjectId;

    await createTestProjectMember({
      projectId,
      userId,
      role: "owner",
      invitedBy: userId,
    });

    server = createFakeMcpServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerTaskTools(server as any);
  }

  it("update_task with dueDate change should return task without reminderAt", async () => {
    await setupFixtures();

    // Create a task with a reminder
    const reminderAt = new Date("2026-04-01T09:00:00Z");
    const dueDate = new Date("2026-04-02T00:00:00Z");
    const task = await createTestTask({
      projectId,
      userId,
      dueDate,
      reminderAt,
    });

    // Update the dueDate without explicitly setting reminderAt
    const result = await server.callTool("update_task", {
      taskId: task._id.toString(),
      dueDate: "2026-05-01T00:00:00Z",
    });

    // Parse the returned task
    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text,
    );

    // The returned task should NOT have the old reminderAt value
    // Bug: the returned task still carried stale reminderAt because
    // the $unset happened in a separate DB write after the read
    expect(parsed.reminderAt).toBeNull();

    // Also verify the DB state
    const dbTask = await Task.findById(task._id).lean();
    expect(dbTask?.reminderAt).toBeUndefined();
  });
});
