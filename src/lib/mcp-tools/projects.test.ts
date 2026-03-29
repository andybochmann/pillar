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
  createTestNote,
} from "@/test/helpers";
import { Note } from "@/models/note";
import { Task } from "@/models/task";
import { ProjectMember } from "@/models/project-member";
import { Project } from "@/models/project";
import { registerProjectTools } from "./projects";

// Mock event bus to prevent SSE emissions during tests
vi.mock("@/lib/event-bus", () => ({
  emitSyncEvent: vi.fn(),
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

describe("MCP delete_project", () => {
  let userId: mongoose.Types.ObjectId;
  let categoryId: mongoose.Types.ObjectId;
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
    categoryId = category._id as mongoose.Types.ObjectId;

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
    registerProjectTools(server as any);
  }

  it("delete_project should cascade delete notes for the project", async () => {
    await setupFixtures();

    // Create tasks and notes for this project
    await createTestTask({ projectId, userId });
    await createTestNote({
      parentType: "project",
      projectId,
      userId,
    });
    await createTestNote({
      parentType: "project",
      projectId,
      userId,
      title: "Second project note",
    });

    // Verify notes exist before delete
    const notesBefore = await Note.countDocuments({ projectId });
    expect(notesBefore).toBe(2);

    // Call delete_project
    const result = await server.callTool("delete_project", {
      projectId: projectId.toString(),
    });

    // Should succeed
    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text,
    );
    expect(parsed.success).toBe(true);

    // Notes should be cascade deleted
    const notesAfter = await Note.countDocuments({ projectId });
    expect(notesAfter).toBe(0);

    // Tasks should also be deleted (existing behavior)
    const tasksAfter = await Task.countDocuments({ projectId });
    expect(tasksAfter).toBe(0);
  });
});
