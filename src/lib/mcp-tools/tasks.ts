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
import type {
  LeanTask,
  SerializedTask,
  SerializedSubtask,
  SerializedRecurrence,
  SerializedStatusHistoryEntry,
} from "@/lib/mcp-tools/types";

function serializeDate(date: Date | undefined): string | null {
  if (date instanceof Date) return date.toISOString();
  return null;
}

function serializeTask(task: LeanTask): SerializedTask {
  return {
    _id: task._id.toString(),
    title: task.title,
    description: task.description,
    projectId: task.projectId.toString(),
    userId: task.userId.toString(),
    assigneeId: task.assigneeId ? task.assigneeId.toString() : null,
    columnId: task.columnId,
    priority: task.priority,
    dueDate: serializeDate(task.dueDate),
    recurrence: {
      frequency: task.recurrence.frequency,
      interval: task.recurrence.interval,
      endDate: serializeDate(task.recurrence.endDate),
    } as SerializedRecurrence,
    order: task.order,
    labels: task.labels.map((id) => id.toString()),
    subtasks: task.subtasks.map((s) => ({
      _id: s._id.toString(),
      title: s.title,
      completed: s.completed,
    })) as SerializedSubtask[],
    statusHistory: task.statusHistory.map((h) => ({
      columnId: h.columnId,
      timestamp: h.timestamp.toISOString(),
    })) as SerializedStatusHistoryEntry[],
    completedAt: serializeDate(task.completedAt),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
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
            text: JSON.stringify(serializeTask(task.toObject())),
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
        data: serializeTask(task),
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
        data: serializeTask(task),
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
        data: serializeTask(task),
        timestamp: Date.now(),
      });

      // Handle recurrence
      if (
        existing.recurrence &&
        existing.recurrence.frequency !== "none"
      ) {
        const nextDue = computeNextDueDate(
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

function computeNextDueDate(
  current: Date,
  frequency: string,
  interval: number,
): Date {
  const next = new Date(current);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + interval);
      break;
  }
  return next;
}
