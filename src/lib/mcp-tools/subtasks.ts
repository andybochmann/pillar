import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpUserId } from "@/lib/mcp-server";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import {
  requireProjectRole,
  getProjectMemberUserIds,
} from "@/lib/project-access";

function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerSubtaskTools(server: McpServer) {
  server.tool(
    "add_subtask",
    "Add a subtask to a task",
    {
      taskId: z.string(),
      title: z.string().min(1).max(200),
    },
    async ({ taskId, title }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) return errorResponse("Task not found");

      try {
        await requireProjectRole(userId, existing.projectId.toString(), "editor");
      } catch {
        return errorResponse("Task not found");
      }

      const task = await Task.findByIdAndUpdate(
        taskId,
        { $push: { subtasks: { title, completed: false } } },
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
        timestamp: Date.now(),
      });

      const newSubtask = task.subtasks[task.subtasks.length - 1];
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              _id: newSubtask._id.toString(),
              title: newSubtask.title,
              completed: newSubtask.completed,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "update_subtask",
    "Update a subtask's title or completed status",
    {
      taskId: z.string(),
      subtaskId: z.string(),
      title: z.string().min(1).max(200).optional(),
      completed: z.boolean().optional(),
    },
    async ({ taskId, subtaskId, title, completed }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) return errorResponse("Task not found");

      try {
        await requireProjectRole(userId, existing.projectId.toString(), "editor");
      } catch {
        return errorResponse("Task not found");
      }

      const update: Record<string, unknown> = {};
      if (title !== undefined) update["subtasks.$.title"] = title;
      if (completed !== undefined) update["subtasks.$.completed"] = completed;

      const task = await Task.findOneAndUpdate(
        { _id: taskId, "subtasks._id": subtaskId },
        { $set: update },
        { returnDocument: "after" },
      ).lean();

      if (!task) return errorResponse("Subtask not found");

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
        timestamp: Date.now(),
      });

      const sub = task.subtasks.find(
        (s) => s._id.toString() === subtaskId,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              _id: sub?._id.toString(),
              title: sub?.title,
              completed: sub?.completed,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "delete_subtask",
    "Delete a subtask from a task",
    {
      taskId: z.string(),
      subtaskId: z.string(),
    },
    async ({ taskId, subtaskId }) => {
      const userId = getMcpUserId();
      const existing = await Task.findById(taskId);
      if (!existing) return errorResponse("Task not found");

      try {
        await requireProjectRole(userId, existing.projectId.toString(), "editor");
      } catch {
        return errorResponse("Task not found");
      }

      await Task.findByIdAndUpdate(taskId, {
        $pull: { subtasks: { _id: subtaskId } },
      });

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
        timestamp: Date.now(),
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );
}
