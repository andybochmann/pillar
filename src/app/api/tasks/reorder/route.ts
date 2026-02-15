import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";

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

    // Verify all tasks exist and user has access to their projects
    const tasks = await Task.find({ _id: { $in: taskIds } }, { projectId: 1 });
    if (tasks.length !== taskIds.length) {
      return NextResponse.json(
        { error: "One or more tasks not found" },
        { status: 404 },
      );
    }

    // Verify all tasks belong to the same project
    const projectId = tasks[0].projectId.toString();
    if (tasks.some((t) => t.projectId.toString() !== projectId)) {
      return NextResponse.json(
        { error: "All tasks must belong to the same project" },
        { status: 400 },
      );
    }

    // Verify membership on the project
    const role = await getProjectRole(session.user.id, projectId);
    if (!role) {
      return NextResponse.json(
        { error: "One or more tasks not found" },
        { status: 404 },
      );
    }
    if (role === "viewer") {
      return NextResponse.json(
        { error: "Viewers cannot reorder tasks" },
        { status: 403 },
      );
    }

    const bulkOps = result.data.tasks.map((t) => ({
      updateOne: {
        filter: { _id: t.id },
        update: { $set: { order: t.order } },
      },
    }));

    await Task.bulkWrite(bulkOps);

    const targetUserIds = await getProjectMemberUserIds(projectId);
    emitSyncEvent({
      entity: "task",
      action: "reordered",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: "",
      projectId,
      targetUserIds,
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
