import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Label } from "@/models/label";
import { Task } from "@/models/task";

const UpdateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateLabelSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const existing = await Label.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!existing) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    // If renaming, cascade to all tasks that use the old name
    if (result.data.name && result.data.name !== existing.name) {
      const duplicate = await Label.findOne({
        userId: session.user.id,
        name: result.data.name,
        _id: { $ne: id },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Label already exists" },
          { status: 409 },
        );
      }

      await Task.updateMany(
        { userId: session.user.id, labels: existing.name },
        { $set: { "labels.$": result.data.name } },
      );
    }

    const label = await Label.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      result.data,
      { returnDocument: "after" },
    );

    return NextResponse.json(label);
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

  const label = await Label.findOne({ _id: id, userId: session.user.id });

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  // Remove label name from all tasks
  await Task.updateMany(
    { userId: session.user.id, labels: label.name },
    { $pull: { labels: label.name } },
  );

  await Label.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
