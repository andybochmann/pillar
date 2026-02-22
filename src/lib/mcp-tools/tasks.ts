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
import {
  serializeDate,
  errorResponse,
  mcpTextResponse,
} from "@/lib/mcp-helpers";
import { scheduleNextReminder } from "@/lib/reminder-scheduler";

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
    reminderAt: serializeDate(t.reminderAt),
    recurrence: t.recurrence,
    order: t.order,
    labels: Array.isArray(t.labels) ? t.labels.map(String) : [],
    subtasks: t.subtasks,
    statusHistory: t.statusHistory,
    completedAt: serializeDate(t.completedAt),
    archived: t.archived ?? false,
    archivedAt: serializeDate(t.archivedAt),
    createdAt: serializeDate(t.createdAt),
    updatedAt: serializeDate(t.updatedAt),
  };
}

export function registerTaskTools(server: McpServer) {
  server.tool(
    "list_tasks",
    "List tasks in a project, sorted by order. Filter by columnId, priority (urgent/high/medium/low), assigneeId, or full-text search. Requires at least viewer access to the project.",
    {
      projectId: z.string(),
      columnId: z.string().optional(),
      priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
      search: z.string().optional(),
      assigneeId: z.string().optional(),
      archived: z.boolean().optional(),
    },
    async ({ projectId, columnId, priority, search, assigneeId, archived }) => {
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
      filter.archived = archived === true ? true : { $ne: true };

      const tasks = await Task.find(filter)
        .sort({ order: 1 })
        .lean();

      return mcpTextResponse(tasks.map(serializeTask));
    },
  );

  server.tool(
    "get_task",
    "Get a single task by ID with all details including subtasks, labels, status history, and reminder time.",
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

      return mcpTextResponse(serializeTask(task));
    },
  );

  server.tool(
    "create_task",
    "Create a new task in a project. Defaults to 'todo' column with 'medium' priority. If dueDate is provided without reminderAt, a reminder is auto-scheduled based on user notification preferences. Pass subtasks as an array of title strings. dueDate and reminderAt accept ISO 8601 datetime strings.",
    {
      title: z.string().min(1).max(200),
      projectId: z.string(),
      columnId: z.string().optional(),
      description: z.string().max(2000).optional(),
      priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
      dueDate: z.string().optional(),
      reminderAt: z.string().optional(),
      assigneeId: z.string().optional(),
      subtasks: z.array(z.string()).optional(),
    },
    async ({ title, projectId, columnId, description, priority, dueDate, reminderAt, assigneeId, subtasks }) => {
      const userId = getMcpUserId();
      try {
        await requireProjectRole(userId, projectId, "editor");
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        return errorResponse(status === 403 ? "Forbidden" : "Project not found");
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
        reminderAt: reminderAt ? new Date(reminderAt) : undefined,
        assigneeId: assigneeId ?? undefined,
        subtasks: subtasks?.map((s) => ({ title: s, completed: false })) ?? [],
        order: taskCount,
        statusHistory: [{ columnId: columnId ?? "todo", timestamp: new Date() }],
      });

      // Auto-schedule reminder when dueDate is set but reminderAt is not
      if (dueDate && !reminderAt) {
        scheduleNextReminder(task._id.toString()).catch(() => {});
      }

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

      return mcpTextResponse(serializeTask(task.toObject() as unknown as Record<string, unknown>));
    },
  );

  server.tool(
    "update_task",
    "Update task fields. Set dueDate or reminderAt to null to clear them. Changing columnId automatically records a status history entry. If dueDate is changed without explicitly setting reminderAt, the reminder is auto-rescheduled from user preferences.",
    {
      taskId: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      columnId: z.string().optional(),
      priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
      dueDate: z.string().nullable().optional(),
      reminderAt: z.string().nullable().optional(),
      assigneeId: z.string().nullable().optional(),
      completedAt: z.string().nullable().optional(),
      archived: z.boolean().optional(),
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
      if (updates.reminderAt !== undefined) {
        update.reminderAt = updates.reminderAt ? new Date(updates.reminderAt) : null;
      }
      if (updates.assigneeId !== undefined) {
        update.assigneeId = updates.assigneeId ?? null;
      }
      if (updates.completedAt !== undefined) {
        update.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
      }
      if (updates.archived !== undefined) {
        update.archived = updates.archived;
        update.archivedAt = updates.archived ? new Date() : null;
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

      // Auto-schedule reminder when dueDate changed but reminderAt not explicitly set
      if (
        updates.dueDate !== undefined &&
        updates.dueDate !== null &&
        updates.reminderAt === undefined
      ) {
        await Task.updateOne({ _id: taskId }, { $unset: { reminderAt: 1 } });
        scheduleNextReminder(taskId).catch(() => {});
      }

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

      return mcpTextResponse(serializeTask(task));
    },
  );

  server.tool(
    "delete_task",
    "Delete a task. Requires editor role or higher on the project.",
    { taskId: z.string() },
    async ({ taskId }) => {
      const userId = getMcpUserId();
      const task = await Task.findById(taskId);
      if (!task) return errorResponse("Task not found");

      try {
        await requireProjectRole(userId, task.projectId.toString(), "editor");
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        return errorResponse(status === 403 ? "Forbidden" : "Task not found");
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

      return mcpTextResponse({ success: true });
    },
  );

  server.tool(
    "move_task",
    "Move a task to a different column (e.g., 'todo' to 'in-progress'). Records a status history entry. Requires editor role.",
    { taskId: z.string(), columnId: z.string() },
    async ({ taskId, columnId }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) {
        return errorResponse("Task not found");
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

      return mcpTextResponse(serializeTask(task));
    },
  );

  server.tool(
    "complete_task",
    "Mark a task as completed by setting completedAt and moving it to the 'done' column. If the task has recurrence configured, automatically creates the next occurrence with the same settings.",
    { taskId: z.string() },
    async ({ taskId }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) {
        return errorResponse("Task not found");
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

      return mcpTextResponse(serializeTask(task));
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
