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
import { Category } from "@/models/category";
import { registerCategoryTools } from "./categories";

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

describe("MCP delete_category", () => {
  let userId: mongoose.Types.ObjectId;
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

    server = createFakeMcpServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCategoryTools(server as any);
  }

  it("delete_category should cascade delete notes for the category and its projects", async () => {
    await setupFixtures();

    const category = await createTestCategory({ userId });
    const categoryId = category._id as mongoose.Types.ObjectId;

    // Create two projects in this category
    const project1 = await createTestProject({ categoryId, userId });
    const project1Id = project1._id as mongoose.Types.ObjectId;
    const project2 = await createTestProject({ categoryId, userId, name: "Project 2" });
    const project2Id = project2._id as mongoose.Types.ObjectId;

    // Create project members (needed for cascade)
    await createTestProjectMember({ projectId: project1Id, userId, role: "owner", invitedBy: userId });
    await createTestProjectMember({ projectId: project2Id, userId, role: "owner", invitedBy: userId });

    // Create tasks
    await createTestTask({ projectId: project1Id, userId });
    await createTestTask({ projectId: project2Id, userId });

    // Create notes at category level
    await createTestNote({
      parentType: "category",
      categoryId,
      userId,
      title: "Category note",
    });

    // Create notes at project level
    await createTestNote({
      parentType: "project",
      projectId: project1Id,
      userId,
      title: "Project 1 note",
    });
    await createTestNote({
      parentType: "project",
      projectId: project2Id,
      userId,
      title: "Project 2 note",
    });

    // Verify notes exist before delete
    const categoryNotesBefore = await Note.countDocuments({ categoryId });
    expect(categoryNotesBefore).toBe(1);
    const projectNotesBefore = await Note.countDocuments({
      projectId: { $in: [project1Id, project2Id] },
    });
    expect(projectNotesBefore).toBe(2);

    // Call delete_category
    const result = await server.callTool("delete_category", {
      categoryId: categoryId.toString(),
    });

    // Should succeed
    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text,
    );
    expect(parsed.success).toBe(true);

    // All notes should be cascade deleted (both category-level and project-level)
    const categoryNotesAfter = await Note.countDocuments({ categoryId });
    expect(categoryNotesAfter).toBe(0);
    const projectNotesAfter = await Note.countDocuments({
      projectId: { $in: [project1Id, project2Id] },
    });
    expect(projectNotesAfter).toBe(0);

    // Tasks and projects should also be deleted (existing behavior)
    const tasksAfter = await Task.countDocuments({
      projectId: { $in: [project1Id, project2Id] },
    });
    expect(tasksAfter).toBe(0);
    const projectsAfter = await Project.countDocuments({ categoryId });
    expect(projectsAfter).toBe(0);
  });
});
