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
import { getBlockerStatus } from "@/lib/task-dependencies";
import { getNextDueDate } from "@/lib/date-utils";
import { scheduleNextReminder } from "@/lib/reminder-scheduler";

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

    // Completion guard: cannot complete while any blocker is still open.
    const blockedBy = (task.blockedBy ?? []).map((b) => b.toString());
    if (blockedBy.length > 0) {
      const blockers = await Task.find({ _id: { $in: blockedBy } })
        .select("_id completedAt archived")
        .lean();
      const tasksById = new Map(blockers.map((b) => [b._id.toString(), b]));
      const { openCount } = getBlockerStatus(blockedBy, tasksById);
      if (openCount > 0) {
        return NextResponse.json(
          {
            error: `Cannot complete: blocked by ${openCount} open task${openCount === 1 ? "" : "s"}`,
          },
          { status: 409 },
        );
      }
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
    const setFields: Record<string, unknown> = {
      completedAt: now,
    };

    // Move to done column if found and different from current
    if (doneColumn && task.columnId !== doneColumn.id) {
      setFields.columnId = doneColumn.id;
    }

    const updateDoc: Record<string, unknown> = {
      $set: setFields,
      $unset: { reminderAt: 1 },
    };

    if (doneColumn && task.columnId !== doneColumn.id) {
      updateDoc.$push = {
        statusHistory: {
          columnId: doneColumn.id,
          timestamp: now,
        },
      };
    }

    // Atomically claim the completion: only the request that transitions the
    // task from incomplete → complete spawns the next occurrence. Concurrent
    // completes (double-click / offline replay) will not match and therefore
    // won't create duplicate occurrences.
    const updatedTask = await Task.findOneAndUpdate(
      { _id: id, completedAt: null },
      updateDoc,
      { returnDocument: "after" },
    );

    if (!updatedTask) {
      // Either the task was deleted, or it was already completed by a
      // concurrent request — return its current state without spawning.
      const current = await Task.findById(id);
      if (!current) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json(current);
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
          const maxOrderTask = await Task.findOne({
            projectId: task.projectId,
            columnId: firstColumn.id,
          })
            .sort({ order: -1 })
            .select("order")
            .lean();
          const newOrder = (maxOrderTask?.order ?? -1) + 1;

          const newTask = await Task.create({
            title: updatedTask.title,
            description: updatedTask.description,
            projectId: updatedTask.projectId,
            userId: updatedTask.userId,
            assigneeId: updatedTask.assigneeId,
            columnId: firstColumn.id,
            priority: updatedTask.priority,
            dueDate: nextDueDate,
            recurrence: updatedTask.recurrence,
            order: newOrder,
            labels: updatedTask.labels,
            subtasks: updatedTask.subtasks.map((s) => ({
              title: s.title,
              completed: false,
            })),
            statusHistory: [
              { columnId: firstColumn.id, timestamp: new Date() },
            ],
          });

          // Schedule the auto-reminder for the newly-created occurrence.
          scheduleNextReminder(newTask._id.toString()).catch((err) => {
            console.error(
              `[tasks/complete] Failed to schedule reminder for task ${newTask._id}:`,
              err,
            );
          });

          // Emit the side-effect "created" event with an empty sessionId so it
          // is NOT suppressed for the originating tab (the SSE endpoint skips
          // events whose sessionId matches the connected tab). Other tabs still
          // receive it because their sessionId never equals "".
          emitSyncEvent({
            entity: "task",
            action: "created",
            userId: session.user.id,
            sessionId: "",
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
