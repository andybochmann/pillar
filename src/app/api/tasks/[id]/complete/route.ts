import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import {
  requireProjectRole,
  getProjectMemberUserIds,
} from "@/lib/project-access";
import { getNextDueDate } from "@/lib/date-utils";

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
    await connectDB();

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Require editor+ role on the task's project
    try {
      await requireProjectRole(
        session.user.id,
        task.projectId.toString(),
        "editor",
      );
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 500;
      if (status === 404) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Already completed — return as-is
    if (task.completedAt) {
      return NextResponse.json(task);
    }

    // Find the project's last column (highest order) as the "done" column
    const project = await Project.findById(task.projectId);
    const sortedColumns = [...(project?.columns ?? [])].sort(
      (a: { order: number }, b: { order: number }) => a.order - b.order,
    );
    const doneColumn = sortedColumns.length > 0
      ? sortedColumns[sortedColumns.length - 1]
      : undefined;

    const now = new Date();
    const updateOps: Record<string, unknown> = {
      completedAt: now,
    };

    // Move to done column if found and different from current
    if (doneColumn && task.columnId !== doneColumn.id) {
      updateOps.columnId = doneColumn.id;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      id,
      {
        ...updateOps,
        $unset: { reminderAt: 1 },
        $push: {
          statusHistory: {
            columnId: doneColumn?.id || task.columnId,
            timestamp: now,
          },
        },
      },
      { returnDocument: "after" },
    );

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const sessionId = request.headers.get("X-Session-Id") ?? "";
    const targetUserIds = await getProjectMemberUserIds(
      task.projectId.toString(),
    );

    emitSyncEvent({
      entity: "task",
      action: "updated",
      userId: session.user.id,
      sessionId,
      entityId: updatedTask._id.toString(),
      projectId: task.projectId.toString(),
      targetUserIds,
      data: updatedTask.toJSON(),
      timestamp: Date.now(),
    });

    // Handle recurrence — create next occurrence
    if (
      updatedTask.recurrence?.frequency !== "none" &&
      updatedTask.dueDate
    ) {
      const nextDueDate = getNextDueDate(
        updatedTask.dueDate,
        updatedTask.recurrence.frequency,
        updatedTask.recurrence.interval ?? 1,
      );

      const shouldCreate =
        !updatedTask.recurrence.endDate ||
        nextDueDate <= updatedTask.recurrence.endDate;

      if (shouldCreate) {
        const firstColumn = sortedColumns?.[0];

        if (firstColumn) {
          const taskCount = await Task.countDocuments({
            projectId: task.projectId,
            columnId: firstColumn.id,
            userId: session.user.id,
          });

          const newTask = await Task.create({
            title: updatedTask.title,
            description: updatedTask.description,
            projectId: updatedTask.projectId,
            userId: updatedTask.userId,
            columnId: firstColumn.id,
            priority: updatedTask.priority,
            dueDate: nextDueDate,
            recurrence: updatedTask.recurrence,
            order: taskCount,
            labels: updatedTask.labels,
            subtasks: updatedTask.subtasks.map((s) => ({
              title: s.title,
              completed: false,
            })),
            statusHistory: [
              { columnId: firstColumn.id, timestamp: new Date() },
            ],
          });

          emitSyncEvent({
            entity: "task",
            action: "created",
            userId: session.user.id,
            sessionId,
            entityId: newTask._id.toString(),
            projectId: task.projectId.toString(),
            targetUserIds,
            data: newTask.toJSON(),
            timestamp: Date.now(),
          });
        }
      }
    }

    return NextResponse.json(updatedTask);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
