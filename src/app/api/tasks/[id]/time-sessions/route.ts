import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";

const TimeSessionActionSchema = z.object({
  action: z.enum(["start", "stop"]),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function emitTaskSync(
  task: typeof Task.prototype,
  userId: string,
  sessionId: string,
) {
  const targetUserIds = await getProjectMemberUserIds(
    task.projectId.toString(),
  );
  emitSyncEvent({
    entity: "task",
    action: "updated",
    userId,
    sessionId,
    entityId: task._id.toString(),
    projectId: task.projectId.toString(),
    targetUserIds,
    data: task.toJSON(),
    timestamp: Date.now(),
  });
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
      // Auto-stop any active session on any task for this user
      const taskWithActive = await Task.findOne({
        "timeSessions": {
          $elemMatch: { userId, endedAt: null },
        },
      });

      if (taskWithActive) {
        await Task.updateOne(
          {
            _id: taskWithActive._id,
            "timeSessions": { $elemMatch: { userId, endedAt: null } },
          },
          { $set: { "timeSessions.$.endedAt": new Date() } },
        );

        const updatedAutoStopped = await Task.findById(taskWithActive._id);
        if (updatedAutoStopped) {
          await emitTaskSync(updatedAutoStopped, userId, sessionId);
        }
      }

      const updated = await Task.findByIdAndUpdate(
        id,
        {
          $push: {
            timeSessions: { startedAt: new Date(), userId },
          },
        },
        { returnDocument: "after" },
      );

      await emitTaskSync(updated!, userId, sessionId);
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

    await emitTaskSync(updated!, userId, sessionId);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
