import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Note } from "@/models/note";
import { Category } from "@/models/category";
import { Task } from "@/models/task";
import {
  getProjectRole,
  getProjectMemberUserIds,
} from "@/lib/project-access";

const CreateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().max(50000).optional(),
  parentType: z.enum(["category", "project", "task"]),
  categoryId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  pinned: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const projectId = searchParams.get("projectId");
  const taskId = searchParams.get("taskId");
  const parentType = searchParams.get("parentType");
  const search = searchParams.get("search");

  const filter: Record<string, unknown> = {};

  if (taskId) {
    // Task notes: verify project access via the task's projectId
    const task = await Task.findById(taskId).select("projectId");
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const role = await getProjectRole(session.user.id, task.projectId.toString());
    if (!role) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    filter.taskId = taskId;
    filter.parentType = "task";
  } else if (projectId) {
    // Project or task notes under a project
    const role = await getProjectRole(session.user.id, projectId);
    if (!role) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    filter.projectId = projectId;
    if (parentType && ["category", "project", "task"].includes(parentType)) {
      filter.parentType = parentType;
    }
  } else if (categoryId) {
    // Category notes: verify ownership
    const category = await Category.findOne({
      _id: categoryId,
      userId: session.user.id,
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    filter.categoryId = categoryId;
    filter.userId = session.user.id;
    filter.parentType = "category";
  } else {
    return NextResponse.json(
      { error: "Must specify categoryId, projectId, or taskId" },
      { status: 400 },
    );
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const notes = await Note.find(filter).sort({ pinned: -1, order: 1, createdAt: -1 });
  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = CreateNoteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const { parentType } = result.data;
    let projectIdForSync: string | undefined;

    if (parentType === "category") {
      if (!result.data.categoryId) {
        return NextResponse.json(
          { error: "categoryId is required for category notes" },
          { status: 400 },
        );
      }
      const category = await Category.findOne({
        _id: result.data.categoryId,
        userId: session.user.id,
      });
      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
    } else if (parentType === "project") {
      if (!result.data.projectId) {
        return NextResponse.json(
          { error: "projectId is required for project notes" },
          { status: 400 },
        );
      }
      const role = await getProjectRole(session.user.id, result.data.projectId);
      if (!role) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (role === "viewer") {
        return NextResponse.json(
          { error: "Viewers cannot create notes" },
          { status: 403 },
        );
      }
      projectIdForSync = result.data.projectId;
    } else if (parentType === "task") {
      if (!result.data.taskId) {
        return NextResponse.json(
          { error: "taskId is required for task notes" },
          { status: 400 },
        );
      }
      const task = await Task.findById(result.data.taskId).select("projectId");
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      const role = await getProjectRole(session.user.id, task.projectId.toString());
      if (!role) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      if (role === "viewer") {
        return NextResponse.json(
          { error: "Viewers cannot create notes" },
          { status: 403 },
        );
      }
      // Ensure projectId is set for task notes
      result.data.projectId = task.projectId.toString();
      projectIdForSync = task.projectId.toString();
    }

    const countFilter =
      parentType === "category"
        ? { categoryId: result.data.categoryId }
        : parentType === "project"
          ? { projectId: result.data.projectId, parentType: "project" }
          : { taskId: result.data.taskId };
    const noteCount = await Note.countDocuments(countFilter);

    const note = await Note.create({
      ...result.data,
      userId: session.user.id,
      order: result.data.order ?? noteCount,
    });

    const targetUserIds = projectIdForSync
      ? await getProjectMemberUserIds(projectIdForSync)
      : [session.user.id];

    emitSyncEvent({
      entity: "note",
      action: "created",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: note._id.toString(),
      projectId: projectIdForSync,
      targetUserIds,
      data: note.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(note, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
