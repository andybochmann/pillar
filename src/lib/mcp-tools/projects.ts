import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpUserId } from "@/lib/mcp-server";
import { emitSyncEvent } from "@/lib/event-bus";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { ProjectMember } from "@/models/project-member";
import {
  getAccessibleProjectIds,
  getProjectRole,
  requireProjectRole,
  getProjectMemberUserIds,
} from "@/lib/project-access";
import type {
  LeanProject,
  SerializedProject,
  SerializedColumn,
} from "./types";

function serializeDate(date: Date): string {
  return date.toISOString();
}

function serializeProject(project: LeanProject): SerializedProject {
  return {
    _id: project._id.toString(),
    name: project.name,
    description: project.description,
    categoryId: project.categoryId.toString(),
    userId: project.userId.toString(),
    columns: project.columns.map(
      (col): SerializedColumn => ({
        id: col.id,
        name: col.name,
        order: col.order,
      }),
    ),
    viewType: project.viewType,
    archived: project.archived,
    createdAt: serializeDate(project.createdAt),
    updatedAt: serializeDate(project.updatedAt),
  };
}

function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerProjectTools(server: McpServer) {
  server.tool(
    "list_projects",
    "List projects accessible to the current user",
    {
      categoryId: z.string().optional(),
      includeArchived: z.boolean().optional(),
    },
    async ({ categoryId, includeArchived }) => {
      const userId = getMcpUserId();
      const projectIds = await getAccessibleProjectIds(userId);

      const filter: Record<string, unknown> = {
        _id: { $in: projectIds },
      };
      if (categoryId) filter.categoryId = categoryId;
      if (!includeArchived) filter.archived = false;

      const projects = await Project.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(projects.map(serializeProject)),
          },
        ],
      };
    },
  );

  server.tool(
    "get_project",
    "Get a project by ID",
    { projectId: z.string() },
    async ({ projectId }) => {
      const userId = getMcpUserId();
      const role = await getProjectRole(userId, projectId);
      if (!role) return errorResponse("Project not found");

      const project = await Project.findById(projectId).lean();
      if (!project) return errorResponse("Project not found");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...serializeProject(project),
              currentUserRole: role,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "create_project",
    "Create a new project",
    {
      name: z.string().min(1).max(100),
      categoryId: z.string(),
      description: z.string().max(500).optional(),
      viewType: z.enum(["board", "list"]).optional(),
    },
    async ({ name, categoryId, description, viewType }) => {
      const userId = getMcpUserId();
      const project = await Project.create({
        name,
        categoryId,
        userId,
        description,
        viewType: viewType ?? "board",
      });

      // Create owner ProjectMember record
      await ProjectMember.create({
        projectId: project._id,
        userId,
        role: "owner",
        invitedBy: userId,
      });

      emitSyncEvent({
        entity: "project",
        action: "created",
        userId,
        sessionId: "mcp",
        entityId: project._id.toString(),
        data: serializeProject(project.toObject()),
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serializeProject(project.toObject())),
          },
        ],
      };
    },
  );

  server.tool(
    "update_project",
    "Update a project (requires editor role or higher)",
    {
      projectId: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      viewType: z.enum(["board", "list"]).optional(),
      archived: z.boolean().optional(),
      columns: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            order: z.number(),
          }),
        )
        .optional(),
    },
    async ({ projectId, ...updates }) => {
      const userId = getMcpUserId();
      try {
        await requireProjectRole(userId, projectId, "editor");
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        return errorResponse(status === 403 ? "Forbidden" : "Project not found");
      }

      const update: Record<string, unknown> = {};
      if (updates.name !== undefined) update.name = updates.name;
      if (updates.description !== undefined) update.description = updates.description;
      if (updates.viewType !== undefined) update.viewType = updates.viewType;
      if (updates.archived !== undefined) update.archived = updates.archived;
      if (updates.columns !== undefined) update.columns = updates.columns;

      const project = await Project.findByIdAndUpdate(
        projectId,
        { $set: update },
        { returnDocument: "after" },
      ).lean();

      if (!project) return errorResponse("Project not found");

      const targetUserIds = await getProjectMemberUserIds(projectId);
      emitSyncEvent({
        entity: "project",
        action: "updated",
        userId,
        sessionId: "mcp",
        entityId: projectId,
        targetUserIds,
        data: serializeProject(project),
        timestamp: Date.now(),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(serializeProject(project)),
          },
        ],
      };
    },
  );

  server.tool(
    "delete_project",
    "Delete a project and all its tasks (requires owner role)",
    { projectId: z.string() },
    async ({ projectId }) => {
      const userId = getMcpUserId();
      try {
        await requireProjectRole(userId, projectId, "owner");
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        return errorResponse(status === 403 ? "Forbidden" : "Project not found");
      }

      const targetUserIds = await getProjectMemberUserIds(projectId);

      await Promise.all([
        Project.findByIdAndDelete(projectId),
        Task.deleteMany({ projectId }),
        ProjectMember.deleteMany({ projectId }),
      ]);

      emitSyncEvent({
        entity: "project",
        action: "deleted",
        userId,
        sessionId: "mcp",
        entityId: projectId,
        targetUserIds,
        timestamp: Date.now(),
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );
}
