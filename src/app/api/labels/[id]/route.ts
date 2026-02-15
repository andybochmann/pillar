import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
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

    // Check for duplicate name if renaming
    if (result.data.name) {
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
    }

    const label = await Label.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      result.data,
      { returnDocument: "after" },
    );

    if (!label) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    emitSyncEvent({
      entity: "label",
      action: "updated",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: id,
      data: label.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(label);
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

    const label = await Label.findOneAndDelete(
      { _id: id, userId: session.user.id },
      { session: dbSession },
    );

    if (!label) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Label not found" },
        { status: 404 },
      );
    }

    await Task.updateMany(
      { userId: session.user.id, labels: label._id },
      { $pull: { labels: label._id } },
      { session: dbSession },
    );

    await dbSession.commitTransaction();

    emitSyncEvent({
      entity: "label",
      action: "deleted",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
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
