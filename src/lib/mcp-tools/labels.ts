import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpUserId } from "@/lib/mcp-server";
import { emitSyncEvent } from "@/lib/event-bus";
import { errorResponse, mcpTextResponse } from "@/lib/mcp-helpers";
import { Label } from "@/models/label";
import { Task } from "@/models/task";

export function registerLabelTools(server: McpServer) {
  server.tool(
    "list_labels",
    "List all labels for the current user, sorted by name. Labels are user-scoped (not project-scoped).",
    {},
    async () => {
      const userId = getMcpUserId();
      const labels = await Label.find({ userId }).sort({ name: 1 }).lean();

      return mcpTextResponse(
        labels.map((l) => ({
          _id: l._id.toString(),
          name: l.name,
          color: l.color,
        })),
      );
    },
  );

  server.tool(
    "create_label",
    "Create a new label. Color must be a hex string like '#ef4444'. Labels are user-scoped and can be applied to tasks in any project.",
    {
      name: z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #ef4444"),
    },
    async ({ name, color }) => {
      const userId = getMcpUserId();
      const label = await Label.create({ name, color, userId });

      emitSyncEvent({
        entity: "label",
        action: "created",
        userId,
        sessionId: "mcp",
        entityId: label._id.toString(),
        data: {
          _id: label._id.toString(),
          name: label.name,
          color: label.color,
          userId,
          createdAt: label.createdAt.toISOString(),
          updatedAt: label.updatedAt.toISOString(),
        },
        timestamp: Date.now(),
      });

      return mcpTextResponse({
        _id: label._id.toString(),
        name: label.name,
        color: label.color,
      });
    },
  );

  server.tool(
    "delete_label",
    "Delete a label and automatically remove it from all tasks that reference it.",
    { labelId: z.string() },
    async ({ labelId }) => {
      const userId = getMcpUserId();
      const label = await Label.findOneAndDelete({ _id: labelId, userId });

      if (!label) return errorResponse("Label not found");

      await Task.updateMany(
        { labels: labelId },
        { $pull: { labels: labelId } },
      );

      emitSyncEvent({
        entity: "label",
        action: "deleted",
        userId,
        sessionId: "mcp",
        entityId: labelId,
        timestamp: Date.now(),
      });

      return mcpTextResponse({ success: true });
    },
  );
}
