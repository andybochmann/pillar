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
  createTestLabel,
  createTestProjectMember,
} from "@/test/helpers";
import { Task } from "@/models/task";
import { Category } from "@/models/category";
import { Project } from "@/models/project";
import { Label } from "@/models/label";
import { ProjectMember } from "@/models/project-member";
import { mcpAuthContext, createMcpServer } from "./mcp-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

// Helper to call a tool by name on the McpServer
async function callTool(
  server: McpServer,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ text: string; isError?: boolean }> {
  // Access registered tools object and call the handler directly
  // Internal structure: _registeredTools[name].handler is the callback function
  const registeredTools = (server as unknown as {
    _registeredTools: Record<
      string,
      {
        inputSchema: unknown;
        handler: (
          args: Record<string, unknown>,
          extra?: unknown,
        ) => Promise<{
          content: { type: string; text: string }[];
          isError?: boolean;
        }>;
      }
    >;
  })._registeredTools;
  const tool = registeredTools[name];
  if (!tool) throw new Error(`Tool ${name} not registered`);
  const result = tool.inputSchema
    ? await tool.handler(args, {})
    : await (tool.handler as unknown as (extra: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>)({});
  return {
    text: result.content[0].text,
    isError: result.isError,
  };
}

describe("MCP Server Tools", () => {
  let userId: mongoose.Types.ObjectId;
  let otherUserId: mongoose.Types.ObjectId;
  let server: McpServer;

  beforeAll(async () => {
    await setupTestDB();
    const user = await createTestUser();
    userId = user._id;
    const other = await createTestUser({ email: "other@example.com" });
    otherUserId = other._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
    // Recreate users after clearTestDB
    const user = await createTestUser();
    userId = user._id;
    const other = await createTestUser({ email: "other@example.com" });
    otherUserId = other._id;
  });

  function withAuth<T>(fn: () => Promise<T>): Promise<T> {
    return mcpAuthContext.run({ userId: userId.toString() }, fn);
  }

  function withOtherAuth<T>(fn: () => Promise<T>): Promise<T> {
    return mcpAuthContext.run({ userId: otherUserId.toString() }, fn);
  }

  // Recreate server before each group since tool registration is one-time
  function freshServer(): McpServer {
    server = createMcpServer();
    return server;
  }

  describe("Category tools", () => {
    it("list_categories returns only the authenticated user's categories", async () => {
      const s = freshServer();
      await createTestCategory({ userId, name: "My Category" });
      await createTestCategory({ userId: otherUserId, name: "Other Category" });

      const result = await withAuth(() => callTool(s, "list_categories"));
      const cats = JSON.parse(result.text);
      expect(cats).toHaveLength(1);
      expect(cats[0].name).toBe("My Category");
    });

    it("create_category creates and returns category", async () => {
      const s = freshServer();
      const result = await withAuth(() =>
        callTool(s, "create_category", { name: "New Cat", color: "#ff0000" }),
      );
      const cat = JSON.parse(result.text);
      expect(cat.name).toBe("New Cat");
      expect(cat.color).toBe("#ff0000");
    });

    it("delete_category cascades to projects and tasks", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestTask({ userId, projectId: project._id });

      const result = await withAuth(() =>
        callTool(s, "delete_category", { categoryId: cat._id.toString() }),
      );
      expect(JSON.parse(result.text).success).toBe(true);

      expect(await Category.findById(cat._id)).toBeNull();
      expect(await Project.findById(project._id)).toBeNull();
      expect(await Task.countDocuments({ projectId: project._id })).toBe(0);
    });
  });

  describe("Label tools", () => {
    it("list_labels returns only user's labels", async () => {
      const s = freshServer();
      await createTestLabel({ userId, name: "Bug" });
      await createTestLabel({ userId: otherUserId, name: "Other" });

      const result = await withAuth(() => callTool(s, "list_labels"));
      const labels = JSON.parse(result.text);
      expect(labels).toHaveLength(1);
      expect(labels[0].name).toBe("Bug");
    });

    it("delete_label removes label from tasks", async () => {
      const s = freshServer();
      const label = await createTestLabel({ userId });
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestTask({
        userId,
        projectId: project._id,
        labels: [label._id],
      });

      await withAuth(() =>
        callTool(s, "delete_label", { labelId: label._id.toString() }),
      );

      const tasks = await Task.find({ projectId: project._id });
      expect(tasks[0].labels).toHaveLength(0);
    });
  });

  describe("Project tools", () => {
    it("list_projects uses getAccessibleProjectIds", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });

      // Create a project for other user that we don't have access to
      const otherCat = await createTestCategory({ userId: otherUserId });
      await createTestProject({
        userId: otherUserId,
        categoryId: otherCat._id,
      });

      const result = await withAuth(() => callTool(s, "list_projects"));
      const projects = JSON.parse(result.text);
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe("Test Project");
    });

    it("create_project creates owner ProjectMember", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });

      const result = await withAuth(() =>
        callTool(s, "create_project", {
          name: "New Project",
          categoryId: cat._id.toString(),
        }),
      );
      const proj = JSON.parse(result.text);
      expect(proj.name).toBe("New Project");

      const member = await ProjectMember.findOne({
        projectId: proj._id,
        userId,
      });
      expect(member).not.toBeNull();
      expect(member!.role).toBe("owner");
    });

    it("update_project rejects viewer role", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId: otherUserId });
      const project = await createTestProject({
        userId: otherUserId,
        categoryId: cat._id,
      });
      // Give current user viewer access
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "viewer",
        invitedBy: otherUserId,
      });

      const result = await withAuth(() =>
        callTool(s, "update_project", {
          projectId: project._id.toString(),
          name: "Updated",
        }),
      );
      expect(result.isError).toBe(true);
      expect(result.text).toBe("Forbidden");
    });

    it("delete_project requires owner role", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId: otherUserId });
      const project = await createTestProject({
        userId: otherUserId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "editor",
        invitedBy: otherUserId,
      });

      const result = await withAuth(() =>
        callTool(s, "delete_project", {
          projectId: project._id.toString(),
        }),
      );
      expect(result.isError).toBe(true);
      expect(result.text).toBe("Forbidden");
    });
  });

  describe("Task tools", () => {
    it("create_task creates task with correct userId and authorization", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });

      const result = await withAuth(() =>
        callTool(s, "create_task", {
          title: "My Task",
          projectId: project._id.toString(),
          priority: "high",
        }),
      );
      const task = JSON.parse(result.text);
      expect(task.title).toBe("My Task");
      expect(task.priority).toBe("high");
      expect(task.userId).toBe(userId.toString());
      expect(task.columnId).toBe("todo");
    });

    it("create_task rejects if user has no project access", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId: otherUserId });
      const project = await createTestProject({
        userId: otherUserId,
        categoryId: cat._id,
      });

      const result = await withAuth(() =>
        callTool(s, "create_task", {
          title: "Denied",
          projectId: project._id.toString(),
        }),
      );
      expect(result.isError).toBe(true);
    });

    it("list_tasks filters by project membership", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });
      await createTestTask({
        userId,
        projectId: project._id,
        title: "Visible",
      });

      const result = await withAuth(() =>
        callTool(s, "list_tasks", { projectId: project._id.toString() }),
      );
      const tasks = JSON.parse(result.text);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Visible");
    });

    it("update_task pushes statusHistory on column change", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });
      const task = await createTestTask({
        userId,
        projectId: project._id,
        statusHistory: [{ columnId: "todo", timestamp: new Date() }],
      });

      const result = await withAuth(() =>
        callTool(s, "update_task", {
          taskId: task._id.toString(),
          columnId: "in-progress",
        }),
      );
      const updated = JSON.parse(result.text);
      expect(updated.columnId).toBe("in-progress");
      expect(updated.statusHistory).toHaveLength(2);
    });

    it("delete_task checks editor+ role", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId: otherUserId });
      const project = await createTestProject({
        userId: otherUserId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "viewer",
        invitedBy: otherUserId,
      });
      const task = await createTestTask({
        userId: otherUserId,
        projectId: project._id,
      });

      const result = await withAuth(() =>
        callTool(s, "delete_task", { taskId: task._id.toString() }),
      );
      expect(result.isError).toBe(true);
    });

    it("complete_task sets completedAt and moves to done", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });
      const task = await createTestTask({
        userId,
        projectId: project._id,
      });

      const result = await withAuth(() =>
        callTool(s, "complete_task", { taskId: task._id.toString() }),
      );
      const completed = JSON.parse(result.text);
      expect(completed.completedAt).not.toBeNull();
      expect(completed.columnId).toBe("done");
    });

    it("complete_task handles recurrence by creating next occurrence", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });
      const dueDate = new Date("2025-06-01");
      await createTestTask({
        userId,
        projectId: project._id,
        title: "Recurring",
        dueDate,
        recurrence: { frequency: "weekly", interval: 1 },
      });

      const tasksBefore = await Task.countDocuments({
        projectId: project._id,
      });
      expect(tasksBefore).toBe(1);

      const tasks = await Task.find({ projectId: project._id });
      await withAuth(() =>
        callTool(s, "complete_task", {
          taskId: tasks[0]._id.toString(),
        }),
      );

      const tasksAfter = await Task.countDocuments({
        projectId: project._id,
      });
      expect(tasksAfter).toBe(2);

      const nextTask = await Task.findOne({
        projectId: project._id,
        completedAt: null,
      });
      expect(nextTask!.title).toBe("Recurring");
      expect(nextTask!.columnId).toBe("todo");
      expect(nextTask!.dueDate!.getTime()).toBe(
        new Date("2025-06-08").getTime(),
      );
    });
  });

  describe("Subtask tools", () => {
    it("add_subtask pushes to subtasks array", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });
      const task = await createTestTask({
        userId,
        projectId: project._id,
      });

      const result = await withAuth(() =>
        callTool(s, "add_subtask", {
          taskId: task._id.toString(),
          title: "Sub 1",
        }),
      );
      const sub = JSON.parse(result.text);
      expect(sub.title).toBe("Sub 1");
      expect(sub.completed).toBe(false);

      const updated = await Task.findById(task._id);
      expect(updated!.subtasks).toHaveLength(1);
    });

    it("update_subtask updates embedded doc", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });
      const task = await createTestTask({
        userId,
        projectId: project._id,
        subtasks: [{ title: "Original" }],
      });

      const subtaskId = task.subtasks[0]._id.toString();
      const result = await withAuth(() =>
        callTool(s, "update_subtask", {
          taskId: task._id.toString(),
          subtaskId,
          completed: true,
        }),
      );
      const sub = JSON.parse(result.text);
      expect(sub.completed).toBe(true);
    });

    it("delete_subtask pulls from subtasks array", async () => {
      const s = freshServer();
      const cat = await createTestCategory({ userId });
      const project = await createTestProject({
        userId,
        categoryId: cat._id,
      });
      await createTestProjectMember({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });
      const task = await createTestTask({
        userId,
        projectId: project._id,
        subtasks: [{ title: "To Delete" }],
      });

      const subtaskId = task.subtasks[0]._id.toString();
      await withAuth(() =>
        callTool(s, "delete_subtask", {
          taskId: task._id.toString(),
          subtaskId,
        }),
      );

      const updated = await Task.findById(task._id);
      expect(updated!.subtasks).toHaveLength(0);
    });
  });
});
