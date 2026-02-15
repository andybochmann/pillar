import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";

const BulkUpdateSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1, "At least one task ID required"),
  action: z.enum(["move", "priority", "delete"]),
  columnId: z.string().min(1).optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = BulkUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const { taskIds, action, columnId, priority } = result.data;
    const filter = { _id: { $in: taskIds }, userId: session.user.id };

    if (action === "move") {
      if (!columnId) {
        return NextResponse.json(
          { error: "columnId required for move action" },
          { status: 400 },
        );
      }

      await Task.updateMany(
        { ...filter, columnId: { $ne: columnId } },
        {
          $set: { columnId },
          $push: { statusHistory: { columnId, timestamp: new Date() } },
        },
      );
    } else if (action === "priority") {
      if (!priority) {
        return NextResponse.json(
          { error: "priority required for priority action" },
          { status: 400 },
        );
      }
      await Task.updateMany(filter, { $set: { priority } });
    } else if (action === "delete") {
      await Task.deleteMany(filter);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
