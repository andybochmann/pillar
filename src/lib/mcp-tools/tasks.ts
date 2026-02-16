import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpUserId } from "@/lib/mcp-server";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import {
  requireProjectRole,
  getProjectMemberUserIds,
} from "@/lib/project-access";
import { getNextDueDate } from "@/lib/date-utils";

function serializeDate(date: unknown): string | null {
  if (date instanceof Date) return date.toISOString();
  return date ? String(date) : null;
}

function serializeTask(task: unknown) {
  const t = task as Record<string, unknown>;
  return {
    _id: String(t._id),
    title: t.title,
    description: t.description,
    projectId: String(t.projectId),
    userId: String(t.userId),
    assigneeId: t.assigneeId ? String(t.assigneeId) : null,
    columnId: t.columnId,
    priority: t.priority,
    dueDate: serializeDate(t.dueDate),
    recurrence: t.recurrence,
    order: t.order,
    labels: Array.isArray(t.labels) ? t.labels.map(String) : [],
    subtasks: t.subtasks,
    statusHistory: t.statusHistory,
    completedAt: serializeDate(t.completedAt),
    createdAt: serializeDate(t.createdAt),
    updatedAt: serializeDate(t.updatedAt),
  };
}

function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerTaskTools(server: McpServer) {
  server.tool(
    "list_tasks",
    "List tasks in a project",
    {
      projectId: z.string(),
      columnId: z.string().optional(),
      priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
      search: z.string().optional(),
      assigneeId: z.string().optional(),
    },
    async ({ projectId, columnId, priority, search, assigneeId }) => {
      const userId = getMcpUserId();
      try {
        await requireProjectRole(userId, projectId, "viewer");
      } catch {
        return errorResponse("Project not found or no access");
      }

      const filter: Record<string, unknown> = { projectId };
      if (columnId) filter.columnId = columnId;
      if (priority) filter.priority = priority;
      if (assigneeId) filter.assigneeId = assigneeId;
      if (search) filter.$text = { $search: search };

      const tasks = await Task.find(filter)
        .sort({ order: 1 })
        .lean();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(tasks.map(serializeTask)),
          },
        ],
      };
    },
  );

  server.tool(
    "get_task",
    "Get a task by ID",
    { taskId: z.string() },
    async ({ taskId }) => {
      const userId = getMcpUserId();
      const task = await Task.findById(taskId).lean();
      if (!task) return errorResponse("Task not found");

      try {
        await requireProjectRole(userId, task.projectId.toString(), "viewer");
      } catch {
        return errorResponse("Task not found");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serializeTask(task)),
          },
        ],
      };
    },
  );

  server.tool(
    "create_task",
    "Create a new task in a project",
    {
      title: z.string().min(1).max(200),
      projectId: z.string(),
      columnId: z.string().optional(),
      description: z.string().max(2000).optional(),
      priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
      dueDate: z.string().optional(),
      assigneeId: z.string().optional(),
      subtasks: z.array(z.string()).optional(),
    },
    async ({ title, projectId, columnId, description, priority, dueDate, assigneeId, subtasks }) => {
      const userId = getMcpUserId();
      try {
        await requireProjectRole(userId, projectId, "editor");
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        return {
          content: [
            {
              type: "text" as const,
              text: status === 403 ? "Forbidden" : "Project not found",
            },
          ],
          isError: true,
        };
      }

      const taskCount = await Task.countDocuments({
        projectId,
        columnId: columnId ?? "todo",
      });

      const task = await Task.create({
        title,
        projectId,
        userId,
        columnId: columnId ?? "todo",
        description,
        priority: priority ?? "medium",
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assigneeId: assigneeId ?? undefined,
        subtasks: subtasks?.map((s) => ({ title: s, completed: false })) ?? [],
        order: taskCount,
        statusHistory: [{ columnId: columnId ?? "todo", timestamp: new Date() }],
      });

      const targetUserIds = await getProjectMemberUserIds(projectId);
      emitSyncEvent({
        entity: "task",
        action: "created",
        userId,
        sessionId: "mcp",
        entityId: task._id.toString(),
        projectId,
        targetUserIds,
        data: serializeTask(task.toObject()),
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serializeTask(task.toObject() as unknown as Record<string, unknown>)),
          },
        ],
      };
    },
  );

  server.tool(
    "update_task",
    "Update a task",
    {
      taskId: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      columnId: z.string().optional(),
      priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
      dueDate: z.string().nullable().optional(),
      assigneeId: z.string().nullable().optional(),
      completedAt: z.string().nullable().optional(),
    },
    async ({ taskId, ...updates }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) return errorResponse("Task not found");

      try {
        await requireProjectRole(userId, existing.projectId.toString(), "editor");
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        return errorResponse(status === 403 ? "Forbidden" : "Project not found");
      }

      const update: Record<string, unknown> = {};
      const push: Record<string, unknown> = {};

      if (updates.title !== undefined) update.title = updates.title;
      if (updates.description !== undefined) update.description = updates.description;
      if (updates.priority !== undefined) update.priority = updates.priority;
      if (updates.dueDate !== undefined) {
        update.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
      }
      if (updates.assigneeId !== undefined) {
        update.assigneeId = updates.assigneeId ?? null;
      }
      if (updates.completedAt !== undefined) {
        update.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
      }

      if (updates.columnId !== undefined && updates.columnId !== existing.columnId) {
        update.columnId = updates.columnId;
        push.statusHistory = { columnId: updates.columnId, timestamp: new Date() };
      }

      const updateOp: Record<string, unknown> = { $set: update };
      if (Object.keys(push).length > 0) {
        updateOp.$push = push;
      }

      const task = await Task.findByIdAndUpdate(taskId, updateOp, {
        returnDocument: "after",
      }).lean();

      if (!task) return errorResponse("Task not found");

      const targetUserIds = await getProjectMemberUserIds(
        existing.projectId.toString(),
      );
      emitSyncEvent({
        entity: "task",
        action: "updated",
        userId,
        sessionId: "mcp",
        entityId: taskId,
        projectId: existing.projectId.toString(),
        targetUserIds,
        data: serializeTask(task as unknown as Record<string, unknown>),
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serializeTask(task)),
          },
        ],
      };
    },
  );

  server.tool(
    "delete_task",
    "Delete a task (requires editor role or higher)",
    { taskId: z.string() },
    async ({ taskId }) => {
      const userId = getMcpUserId();
      const task = await Task.findById(taskId);
      if (!task) return errorResponse("Task not found");

      try {
        await requireProjectRole(userId, task.projectId.toString(), "editor");
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        return {
          content: [
            {
              type: "text" as const,
              text: status === 403 ? "Forbidden" : "Task not found",
            },
          ],
          isError: true,
        };
      }

      const targetUserIds = await getProjectMemberUserIds(
        task.projectId.toString(),
      );

      await Task.findByIdAndDelete(taskId);

      emitSyncEvent({
        entity: "task",
        action: "deleted",
        userId,
        sessionId: "mcp",
        entityId: taskId,
        projectId: task.projectId.toString(),
        targetUserIds,
        timestamp: Date.now(),
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );

  server.tool(
    "move_task",
    "Move a task to a different column",
    { taskId: z.string(), columnId: z.string() },
    async ({ taskId, columnId }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "Task not found" }],
          isError: true,
        };
      }

      try {
        await requireProjectRole(userId, existing.projectId.toString(), "editor");
      } catch {
        return errorResponse("Task not found");
      }

      const task = await Task.findByIdAndUpdate(
        taskId,
        {
          $set: { columnId },
          $push: { statusHistory: { columnId, timestamp: new Date() } },
        },
        { returnDocument: "after" },
      ).lean();

      if (!task) return errorResponse("Task not found");

      const targetUserIds = await getProjectMemberUserIds(
        existing.projectId.toString(),
      );
      emitSyncEvent({
        entity: "task",
        action: "updated",
        userId,
        sessionId: "mcp",
        entityId: taskId,
        projectId: existing.projectId.toString(),
        targetUserIds,
        data: serializeTask(task as unknown as Record<string, unknown>),
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serializeTask(task)),
          },
        ],
      };
    },
  );

  server.tool(
    "complete_task",
    "Mark a task as completed. If the task has recurrence, creates the next occurrence.",
    { taskId: z.string() },
    async ({ taskId }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "Task not found" }],
          isError: true,
        };
      }

      try {
        await requireProjectRole(userId, existing.projectId.toString(), "editor");
      } catch {
        return errorResponse("Task not found");
      }

      const now = new Date();

      // Find the "done" column for the project
      const project = await Project.findById(existing.projectId).lean();
      const doneColumn = project?.columns?.find(
        (c) => c.id === "done",
      );
      const doneColumnId = doneColumn?.id ?? "done";

      const task = await Task.findByIdAndUpdate(
        taskId,
        {
          $set: { completedAt: now, columnId: doneColumnId },
          $push: {
            statusHistory: { columnId: doneColumnId, timestamp: now },
          },
        },
        { returnDocument: "after" },
      ).lean();

      if (!task) return errorResponse("Task not found");

      const targetUserIds = await getProjectMemberUserIds(
        existing.projectId.toString(),
      );

      emitSyncEvent({
        entity: "task",
        action: "updated",
        userId,
        sessionId: "mcp",
        entityId: taskId,
        projectId: existing.projectId.toString(),
        targetUserIds,
        data: serializeTask(task as unknown as Record<string, unknown>),
        timestamp: Date.now(),
      });

      // Handle recurrence
      if (
        existing.recurrence &&
        existing.recurrence.frequency !== "none"
      ) {
        const nextDue = getNextDueDate(
          existing.dueDate ?? now,
          existing.recurrence.frequency,
          existing.recurrence.interval,
        );

        if (
          !existing.recurrence.endDate ||
          nextDue <= existing.recurrence.endDate
        ) {
          const nextTask = await Task.create({
            title: existing.title,
            description: existing.description,
            projectId: existing.projectId,
            userId: existing.userId,
            columnId: "todo",
            priority: existing.priority,
            dueDate: nextDue,
            recurrence: existing.recurrence,
            order: 0,
            labels: existing.labels,
            subtasks: existing.subtasks.map((s) => ({
              title: s.title,
              completed: false,
            })),
            statusHistory: [{ columnId: "todo", timestamp: now }],
          });

          emitSyncEvent({
            entity: "task",
            action: "created",
            userId,
            sessionId: "mcp",
            entityId: nextTask._id.toString(),
            projectId: existing.projectId.toString(),
            targetUserIds,
            data: serializeTask(nextTask.toObject()),
            timestamp: Date.now(),
          });
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serializeTask(task)),
          },
        ],
      };
    },
  );
}
