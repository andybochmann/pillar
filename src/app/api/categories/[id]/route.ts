import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { Project } from "@/models/project";
import { Task } from "@/models/task";

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
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

    return NextResponse.json(category);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const dbSession = await mongoose.startSession();
  try {
    dbSession.startTransaction();

    const category = await Category.findOneAndDelete(
      { _id: id, userId: session.user.id },
      { session: dbSession },
    );

    if (!category) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    const projects = await Project.find(
      { categoryId: id, userId: session.user.id },
      { _id: 1 },
      { session: dbSession },
    );
    const projectIds = projects.map((p) => p._id);
    await Task.deleteMany(
      { projectId: { $in: projectIds }, userId: session.user.id },
      { session: dbSession },
    );
    await Project.deleteMany(
      { categoryId: id, userId: session.user.id },
      { session: dbSession },
    );

    await dbSession.commitTransaction();
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
