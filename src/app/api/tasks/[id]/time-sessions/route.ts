import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { getProjectRole } from "@/lib/project-access";
import { emitTaskSync } from "./emit-task-sync";

const TimeSessionActionSchema = z.object({
  action: z.enum(["start", "stop"]),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = TimeSessionActionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

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
        { error: "Viewers cannot track time" },
        { status: 403 },
      );
    }

    const sessionId = request.headers.get("X-Session-Id") ?? "";
    const userId = session.user.id;

    if (result.data.action === "start") {
      const updated = await Task.findByIdAndUpdate(
        id,
        {
          $push: {
            timeSessions: { startedAt: new Date(), userId },
          },
        },
        { returnDocument: "after" },
      );

      if (!updated) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      await emitTaskSync(updated, userId, sessionId);
      return NextResponse.json(updated);
    }

    // Stop action
    const activeSession = task.timeSessions.find(
      (s) => s.userId.toString() === userId && !s.endedAt,
    );

    if (!activeSession) {
      return NextResponse.json(
        { error: "No active time session" },
        { status: 404 },
      );
    }

    const updated = await Task.findOneAndUpdate(
      {
        _id: id,
        "timeSessions": { $elemMatch: { userId, endedAt: null } },
      },
      { $set: { "timeSessions.$.endedAt": new Date() } },
      { returnDocument: "after" },
    );

    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    await emitTaskSync(updated, userId, sessionId);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
