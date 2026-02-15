import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Project } from "@/models/project";
import { Task } from "@/models/task";

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  categoryId: z.string().min(1).optional(),
  columns: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(50),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
  archived: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const project = await Project.findOne({
    _id: id,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();
    const project = await Project.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      result.data,
      { returnDocument: "after" },
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    emitSyncEvent({
      entity: "project",
      action: "updated",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: id,
      data: project.toJSON(),
      timestamp: Date.now(),
    });

    if (result.data.columns) {
      const newColumnIds = result.data.columns.map((c) => c.id);
      const firstColumnId = result.data.columns.reduce((min, col) =>
        col.order < min.order ? col : min,
      ).id;
      await Task.updateMany(
        {
          projectId: id,
          userId: session.user.id,
          columnId: { $nin: newColumnIds },
        },
        { $set: { columnId: firstColumnId } },
      );
    }

    return NextResponse.json(project);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const dbSession = await mongoose.startSession();
  try {
    dbSession.startTransaction();

    const project = await Project.findOneAndDelete(
      { _id: id, userId: session.user.id },
      { session: dbSession },
    );

    if (!project) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Cascade: delete all tasks in this project
    await Task.deleteMany(
      { projectId: id, userId: session.user.id },
      { session: dbSession },
    );

    await dbSession.commitTransaction();

    const sessionId = request.headers.get("X-Session-Id") ?? "";
    emitSyncEvent({
      entity: "project",
      action: "deleted",
      userId: session.user.id,
      sessionId,
      entityId: id,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    await dbSession.abortTransaction();
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    dbSession.endSession();
  }
}
