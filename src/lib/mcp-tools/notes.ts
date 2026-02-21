import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpUserId } from "@/lib/mcp-server";
import { emitSyncEvent } from "@/lib/event-bus";
import { errorResponse, mcpTextResponse, serializeDate } from "@/lib/mcp-helpers";
import { Note, type INote } from "@/models/note";
import { Category } from "@/models/category";
import { Task } from "@/models/task";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";

function serializeNote(note: INote) {
  return {
    _id: note._id.toString(),
    title: note.title,
    content: note.content,
    parentType: note.parentType,
    categoryId: note.categoryId?.toString(),
    projectId: note.projectId?.toString(),
    taskId: note.taskId?.toString(),
    userId: note.userId.toString(),
    pinned: note.pinned,
    order: note.order,
    createdAt: serializeDate(note.createdAt),
    updatedAt: serializeDate(note.updatedAt),
  };
}

export function registerNoteTools(server: McpServer) {
  server.tool(
    "list_notes",
    "List notes for a category, project, or task. Sorted by pinned first, then order.",
    {
      categoryId: z.string().optional().describe("Filter by category ID (for category notes)"),
      projectId: z.string().optional().describe("Filter by project ID (for project notes)"),
      taskId: z.string().optional().describe("Filter by task ID (for task notes)"),
    },
    async ({ categoryId, projectId, taskId }) => {
      const userId = getMcpUserId();
      const filter: Record<string, unknown> = {};

      if (taskId) {
        const task = await Task.findById(taskId).select("projectId").lean();
        if (!task) return errorResponse("Task not found");
        const role = await getProjectRole(userId, task.projectId.toString());
        if (!role) return errorResponse("Task not found");
        filter.taskId = taskId;
        filter.parentType = "task";
      } else if (projectId) {
        const role = await getProjectRole(userId, projectId);
        if (!role) return errorResponse("Project not found");
        filter.projectId = projectId;
        filter.parentType = "project";
      } else if (categoryId) {
        const category = await Category.findOne({ _id: categoryId, userId }).lean();
        if (!category) return errorResponse("Category not found");
        filter.categoryId = categoryId;
        filter.parentType = "category";
      } else {
        return errorResponse("Must specify categoryId, projectId, or taskId");
      }

      const notes = await Note.find(filter).sort({ pinned: -1, order: 1 }).lean();
      return mcpTextResponse(notes.map(serializeNote));
    },
  );

  server.tool(
    "get_note",
    "Get a single note by ID with all details.",
    { noteId: z.string() },
    async ({ noteId }) => {
      const userId = getMcpUserId();
      const note = await Note.findById(noteId).lean();
      if (!note) return errorResponse("Note not found");

      // Verify access
      if (note.parentType === "category") {
        const cat = await Category.findOne({ _id: note.categoryId, userId }).lean();
        if (!cat) return errorResponse("Note not found");
      } else {
        const role = await getProjectRole(userId, note.projectId!.toString());
        if (!role) return errorResponse("Note not found");
      }

      return mcpTextResponse(serializeNote(note));
    },
  );

  server.tool(
    "create_note",
    "Create a new note. Requires categoryId for category notes, projectId for project notes, or taskId for task notes (projectId will be resolved automatically).",
    {
      title: z.string().min(1).max(200),
      content: z.string().max(50000).optional(),
      parentType: z.enum(["category", "project", "task"]),
      categoryId: z.string().optional(),
      projectId: z.string().optional(),
      taskId: z.string().optional(),
      pinned: z.boolean().optional(),
    },
    async ({ title, content, parentType, categoryId, projectId, taskId, pinned }) => {
      const userId = getMcpUserId();
      let projectIdForSync: string | undefined;

      if (parentType === "category") {
        if (!categoryId) return errorResponse("categoryId is required for category notes");
        const cat = await Category.findOne({ _id: categoryId, userId }).lean();
        if (!cat) return errorResponse("Category not found");
      } else if (parentType === "project") {
        if (!projectId) return errorResponse("projectId is required for project notes");
        const role = await getProjectRole(userId, projectId);
        if (!role) return errorResponse("Project not found");
        if (role === "viewer") return errorResponse("Viewers cannot create notes");
        projectIdForSync = projectId;
      } else if (parentType === "task") {
        if (!taskId) return errorResponse("taskId is required for task notes");
        const task = await Task.findById(taskId).select("projectId").lean();
        if (!task) return errorResponse("Task not found");
        const role = await getProjectRole(userId, task.projectId.toString());
        if (!role) return errorResponse("Task not found");
        if (role === "viewer") return errorResponse("Viewers cannot create notes");
        projectId = task.projectId.toString();
        projectIdForSync = projectId;
      }

      const note = await Note.create({
        title,
        content: content ?? "",
        parentType,
        categoryId,
        projectId,
        taskId,
        userId,
        pinned: pinned ?? false,
      });

      const targetUserIds = projectIdForSync
        ? await getProjectMemberUserIds(projectIdForSync)
        : [userId];

      emitSyncEvent({
        entity: "note",
        action: "created",
        userId,
        sessionId: "mcp",
        entityId: note._id.toString(),
        projectId: projectIdForSync,
        targetUserIds,
        data: note.toJSON(),
        timestamp: Date.now(),
      });

      return mcpTextResponse(serializeNote(note));
    },
  );

  server.tool(
    "update_note",
    "Update a note's title, content, pinned status, or order.",
    {
      noteId: z.string(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().max(50000).optional(),
      pinned: z.boolean().optional(),
      order: z.number().int().min(0).optional(),
    },
    async ({ noteId, ...updates }) => {
      const userId = getMcpUserId();
      const existing = await Note.findById(noteId).lean();
      if (!existing) return errorResponse("Note not found");

      // Verify access
      let projectIdForSync: string | undefined;
      if (existing.parentType === "category") {
        const cat = await Category.findOne({ _id: existing.categoryId, userId }).lean();
        if (!cat) return errorResponse("Note not found");
      } else {
        const pId = existing.projectId!.toString();
        const role = await getProjectRole(userId, pId);
        if (!role) return errorResponse("Note not found");
        if (role === "viewer") return errorResponse("Viewers cannot edit notes");
        projectIdForSync = pId;
      }

      const note = await Note.findByIdAndUpdate(noteId, updates, { returnDocument: "after" });
      if (!note) return errorResponse("Note not found");

      const targetUserIds = projectIdForSync
        ? await getProjectMemberUserIds(projectIdForSync)
        : [userId];

      emitSyncEvent({
        entity: "note",
        action: "updated",
        userId,
        sessionId: "mcp",
        entityId: noteId,
        projectId: projectIdForSync,
        targetUserIds,
        data: note.toJSON(),
        timestamp: Date.now(),
      });

      return mcpTextResponse(serializeNote(note));
    },
  );

  server.tool(
    "delete_note",
    "Delete a note. Requires editor role on the note's project.",
    { noteId: z.string() },
    async ({ noteId }) => {
      const userId = getMcpUserId();
      const note = await Note.findById(noteId).lean();
      if (!note) return errorResponse("Note not found");

      // Verify access
      let projectIdForSync: string | undefined;
      if (note.parentType === "category") {
        const cat = await Category.findOne({ _id: note.categoryId, userId }).lean();
        if (!cat) return errorResponse("Note not found");
      } else {
        const pId = note.projectId!.toString();
        const role = await getProjectRole(userId, pId);
        if (!role) return errorResponse("Note not found");
        if (role === "viewer") return errorResponse("Viewers cannot delete notes");
        projectIdForSync = pId;
      }

      await Note.deleteOne({ _id: noteId });

      const targetUserIds = projectIdForSync
        ? await getProjectMemberUserIds(projectIdForSync)
        : [userId];

      emitSyncEvent({
        entity: "note",
        action: "deleted",
        userId,
        sessionId: "mcp",
        entityId: noteId,
        projectId: projectIdForSync,
        targetUserIds,
        timestamp: Date.now(),
      });

      return mcpTextResponse({ success: true });
    },
  );
}
