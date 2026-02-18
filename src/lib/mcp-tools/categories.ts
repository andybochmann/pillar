import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpUserId } from "@/lib/mcp-server";
import { emitSyncEvent } from "@/lib/event-bus";
import { errorResponse, mcpTextResponse } from "@/lib/mcp-helpers";
import { Category } from "@/models/category";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { ProjectMember } from "@/models/project-member";

export function registerCategoryTools(server: McpServer) {
  server.tool(
    "list_categories",
    "List all categories for the current user, sorted by order. Returns _id, name, color, icon, and order for each category.",
    {},
    async () => {
      const userId = getMcpUserId();
      const categories = await Category.find({ userId })
        .sort({ order: 1 })
        .lean();

      return mcpTextResponse(
        categories.map((c) => ({
          _id: c._id.toString(),
          name: c.name,
          color: c.color,
          icon: c.icon,
          order: c.order,
        })),
      );
    },
  );

  server.tool(
    "create_category",
    "Create a new category. Defaults color to '#6366f1' (indigo) if not provided. Order is auto-assigned based on existing count.",
    { name: z.string().min(1).max(50), color: z.string().optional(), icon: z.string().optional() },
    async ({ name, color, icon }) => {
      const userId = getMcpUserId();
      const count = await Category.countDocuments({ userId });
      const category = await Category.create({
        name,
        color: color ?? "#6366f1",
        icon,
        userId,
        order: count,
      });

      emitSyncEvent({
        entity: "category",
        action: "created",
        userId,
        sessionId: "mcp",
        entityId: category._id.toString(),
        data: {
          _id: category._id.toString(),
          name: category.name,
          color: category.color,
          icon: category.icon,
          order: category.order,
          collapsed: category.collapsed,
          userId,
          createdAt: category.createdAt.toISOString(),
          updatedAt: category.updatedAt.toISOString(),
        },
        timestamp: Date.now(),
      });

      return mcpTextResponse({
        _id: category._id.toString(),
        name: category.name,
        color: category.color,
        icon: category.icon,
        order: category.order,
      });
    },
  );

  server.tool(
    "update_category",
    "Update a category's name or display order. Only name and order can be changed.",
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

      const category = await Category.findOneAndUpdate(
        { _id: categoryId, userId },
        { $set: update },
        { returnDocument: "after" },
      );

      if (!category) return errorResponse("Category not found");

      emitSyncEvent({
        entity: "category",
        action: "updated",
        userId,
        sessionId: "mcp",
        entityId: categoryId,
        data: {
          _id: category._id.toString(),
          name: category.name,
          color: category.color,
          icon: category.icon,
          order: category.order,
          collapsed: category.collapsed,
          userId,
          createdAt: category.createdAt.toISOString(),
          updatedAt: category.updatedAt.toISOString(),
        },
        timestamp: Date.now(),
      });

      return mcpTextResponse({
        _id: category._id.toString(),
        name: category.name,
        color: category.color,
        order: category.order,
      });
    },
  );

  server.tool(
    "delete_category",
    "Delete a category and cascade-delete all its projects, tasks, and project memberships.",
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

      return mcpTextResponse({ success: true });
    },
  );
}
