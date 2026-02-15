import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { getProjectRole } from "@/lib/project-access";

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

    // Verify all tasks exist and user has access
    const tasks = await Task.find({ _id: { $in: taskIds } }, { projectId: 1 });
    if (tasks.length === 0) {
      // No valid tasks found — proceed silently (nothing to do)
      if (action === "move" && !columnId) {
        return NextResponse.json(
          { error: "columnId required for move action" },
          { status: 400 },
        );
      }
      if (action === "priority" && !priority) {
        return NextResponse.json(
          { error: "priority required for priority action" },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: true });
    }

    // Verify membership on each unique project — filter to accessible tasks only
    // Viewers are excluded (they cannot mutate tasks)
    const accessibleTaskIds: string[] = [];
    const projectIds = [...new Set(tasks.map((t) => t.projectId.toString()))];
    const accessibleProjectIds = new Set<string>();
    for (const pid of projectIds) {
      const role = await getProjectRole(session.user.id, pid);
      if (role && role !== "viewer") accessibleProjectIds.add(pid);
    }
    for (const t of tasks) {
      if (accessibleProjectIds.has(t.projectId.toString())) {
        accessibleTaskIds.push(t._id.toString());
      }
    }

    if (accessibleTaskIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const filter = { _id: { $in: accessibleTaskIds } };

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
