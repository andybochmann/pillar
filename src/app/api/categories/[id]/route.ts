import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Category } from "@/models/category";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { Note } from "@/models/note";
import { ProjectMember } from "@/models/project-member";

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
  collapsed: z.boolean().optional(),
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
  const category = await Category.findOne({
    _id: id,
    userId: session.user.id,
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json(category);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateCategorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();
    const category = await Category.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      result.data,
      { returnDocument: "after" },
    );

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    emitSyncEvent({
      entity: "category",
      action: "updated",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: id,
      data: category.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(category);
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

  try {
    const category = await Category.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    const projects = await Project.find(
      { categoryId: id, userId: session.user.id },
      { _id: 1 },
    );
    const projectIds = projects.map((p) => p._id);
    await Task.deleteMany({ projectId: { $in: projectIds } });
    await ProjectMember.deleteMany({ projectId: { $in: projectIds } });
    await Note.deleteMany({
      $or: [
        { categoryId: id },
        { projectId: { $in: projectIds } },
      ],
    });
    await Project.deleteMany({ categoryId: id, userId: session.user.id });

    const sessionId = request.headers.get("X-Session-Id") ?? "";
    emitSyncEvent({
      entity: "category",
      action: "deleted",
      userId: session.user.id,
      sessionId,
      entityId: id,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
