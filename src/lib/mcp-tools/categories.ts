import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpUserId } from "@/lib/mcp-server";
import { emitSyncEvent } from "@/lib/event-bus";
import { Category } from "@/models/category";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { ProjectMember } from "@/models/project-member";
import type { LeanCategory, SerializedCategory } from "./types";

function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/**
 * Converts a LeanCategory (with ObjectId and Date) to SerializedCategory (with strings)
 */
function serializeCategory(category: LeanCategory): SerializedCategory {
  return {
    _id: category._id.toString(),
    name: category.name,
    color: category.color,
    icon: category.icon,
    userId: category.userId.toString(),
    order: category.order,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function registerCategoryTools(server: McpServer) {
  server.tool(
    "list_categories",
    "List all categories for the current user",
    {},
    async () => {
      const userId = getMcpUserId();
      const categories = await Category.find({ userId })
        .sort({ order: 1 })
        .lean<LeanCategory[]>();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(categories.map(serializeCategory)),
          },
        ],
      };
    },
  );

  server.tool(
    "create_category",
    "Create a new category",
    { name: z.string().min(1).max(50), color: z.string().optional(), icon: z.string().optional() },
    async ({ name, color, icon }) => {
      const userId = getMcpUserId();
      const count = await Category.countDocuments({ userId });
      const categoryDoc = await Category.create({
        name,
        color: color ?? "#6366f1",
        icon,
        userId,
        order: count,
      });

      const category = categoryDoc.toObject() as LeanCategory;
      const serialized = serializeCategory(category);

      emitSyncEvent({
        entity: "category",
        action: "created",
        userId,
        sessionId: "mcp",
        entityId: serialized._id,
        data: serialized,
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serialized),
          },
        ],
      };
    },
  );

  server.tool(
    "update_category",
    "Update a category",
    {
      categoryId: z.string(),
      name: z.string().min(1).max(50).optional(),
      order: z.number().int().min(0).optional(),
    },
    async ({ categoryId, name, order }) => {
      const userId = getMcpUserId();
      const update: Record<string, unknown> = {};
      if (name !== undefined) update.name = name;
      if (order !== undefined) update.order = order;

      const categoryDoc = await Category.findOneAndUpdate(
        { _id: categoryId, userId },
        { $set: update },
        { returnDocument: "after" },
      );

      if (!categoryDoc) return errorResponse("Category not found");

      const category = categoryDoc.toObject() as LeanCategory;
      const serialized = serializeCategory(category);

      emitSyncEvent({
        entity: "category",
        action: "updated",
        userId,
        sessionId: "mcp",
        entityId: categoryId,
        data: serialized,
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serialized),
          },
        ],
      };
    },
  );

  server.tool(
    "delete_category",
    "Delete a category and all its projects and tasks",
    { categoryId: z.string() },
    async ({ categoryId }) => {
      const userId = getMcpUserId();
      const category = await Category.findOneAndDelete({
        _id: categoryId,
        userId,
      });

      if (!category) return errorResponse("Category not found");

      const projects = await Project.find(
        { categoryId, userId },
        { _id: 1 },
      ).lean();
      const projectIds = projects.map((p) => p._id);

      await Promise.all([
        Task.deleteMany({ projectId: { $in: projectIds } }),
        ProjectMember.deleteMany({ projectId: { $in: projectIds } }),
        Project.deleteMany({ categoryId, userId }),
      ]);

      emitSyncEvent({
        entity: "category",
        action: "deleted",
        userId,
        sessionId: "mcp",
        entityId: categoryId,
        timestamp: Date.now(),
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );
}
