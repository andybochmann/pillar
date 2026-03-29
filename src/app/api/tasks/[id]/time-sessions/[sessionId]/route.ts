import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { getProjectRole } from "@/lib/project-access";
import { emitTaskSync } from "../emit-task-sync";

interface RouteParams {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, sessionId } = await params;
    await connectDB();

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const role = await getProjectRole(session.user.id, task.projectId.toString());
    if (!role) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (role === "viewer") {
      return NextResponse.json(
        { error: "Viewers cannot modify time sessions" },
        { status: 403 },
      );
    }

    const sessionToDelete = task.timeSessions.find(
      (s) => s._id.toString() === sessionId,
    );
    if (!sessionToDelete) {
      return NextResponse.json(
        { error: "Time session not found" },
        { status: 404 },
      );
    }
    if (sessionToDelete.userId.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete another user's time session" },
        { status: 403 },
      );
    }

    const updated = await Task.findByIdAndUpdate(
      id,
      { $pull: { timeSessions: { _id: sessionId } } },
      { returnDocument: "after" },
    );

    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    await emitTaskSync(
      updated,
      session.user.id,
      request.headers.get("X-Session-Id") ?? "",
    );

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
