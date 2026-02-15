import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";

const ReorderSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = ReorderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const taskIds = result.data.tasks.map((t) => t.id);
    const userId = session.user.id;
    const existingCount = await Task.countDocuments({
      _id: { $in: taskIds },
      userId,
    });

    if (existingCount !== taskIds.length) {
      return NextResponse.json(
        { error: "One or more tasks not found" },
        { status: 404 },
      );
    }

    const bulkOps = result.data.tasks.map((t) => ({
      updateOne: {
        filter: { _id: t.id, userId },
        update: { $set: { order: t.order } },
      },
    }));

    await Task.bulkWrite(bulkOps);

    emitSyncEvent({
      entity: "task",
      action: "reordered",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: "",
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
