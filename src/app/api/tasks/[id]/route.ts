import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { Note } from "@/models/note";
import { Project } from "@/models/project";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";
import { getNextDueDate } from "@/lib/date-utils";
import { scheduleNextReminder } from "@/lib/reminder-scheduler";

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  columnId: z.string().min(1).optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly", "none"]),
      interval: z.number().int().min(1).optional(),
      endDate: z.string().datetime().nullable().optional(),
    })
    .optional(),
  order: z.number().int().min(0).optional(),
  labels: z.array(z.string().max(50)).optional(),
  subtasks: z
    .array(
      z.object({
        _id: z.string().optional(),
        title: z.string().min(1).max(200),
        completed: z.boolean(),
      }),
    )
    .max(50)
    .optional(),
  completedAt: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
  archived: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const task = await Task.findById(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify membership on task's project
  const role = await getProjectRole(session.user.id, task.projectId.toString());
  if (!role) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateTaskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const updateData: Record<string, unknown> = { ...result.data };

    // Strip invalid _id values (e.g. "temp-*") so Mongoose generates real ObjectIds
    if (result.data.subtasks) {
      updateData.subtasks = result.data.subtasks.map(({ _id, ...rest }) => {
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
          return { _id, ...rest };
        }
        return rest;
      });
    }

    if (result.data.dueDate !== undefined) {
      updateData.dueDate = result.data.dueDate ? new Date(result.data.dueDate) : null;
    }

    if (result.data.completedAt !== undefined) {
      updateData.completedAt = result.data.completedAt ? new Date(result.data.completedAt) : null;
    }

    if (result.data.recurrence) {
      updateData.recurrence = {
        ...result.data.recurrence,
        endDate: result.data.recurrence.endDate
          ? new Date(result.data.recurrence.endDate)
          : null,
      };
    }

    if (result.data.reminderAt !== undefined) {
      updateData.reminderAt = result.data.reminderAt ? new Date(result.data.reminderAt) : null;
    }

    // Handle archiving
    if (result.data.archived !== undefined) {
      updateData.archived = result.data.archived;
      updateData.archivedAt = result.data.archived ? new Date() : null;
    }

    // Handle assigneeId: null means unassign
    if (result.data.assigneeId === null) {
      updateData.assigneeId = null;
    }

    // Find task and verify membership
    const existingTask = await Task.findById(id).select("columnId projectId");
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const role = await getProjectRole(session.user.id, existingTask.projectId.toString());
    if (!role) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (role === "viewer") {
      return NextResponse.json(
        { error: "Viewers cannot edit tasks" },
        { status: 403 },
      );
    }

    // Validate assigneeId is a project member
    if (result.data.assigneeId && result.data.assigneeId !== null) {
      const assigneeRole = await getProjectRole(result.data.assigneeId, existingTask.projectId.toString());
      if (!assigneeRole) {
        return NextResponse.json(
          { error: "Assignee is not a project member" },
          { status: 400 },
        );
      }
    }

    const shouldPushHistory =
      result.data.columnId && existingTask.columnId !== result.data.columnId;

    const task = await Task.findByIdAndUpdate(
      id,
      shouldPushHistory
        ? {
            ...updateData,
            $push: {
              statusHistory: {
                columnId: result.data.columnId,
                timestamp: new Date(),
              },
            },
          }
        : updateData,
      { returnDocument: "after" },
    );

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Auto-schedule reminder when dueDate is updated and reminderAt wasn't
    // explicitly set in this request
    if (
      result.data.dueDate !== undefined &&
      result.data.dueDate !== null &&
      result.data.reminderAt === undefined
    ) {
      // Clear existing reminderAt so scheduleNextReminder can set a new one
      await Task.updateOne({ _id: id }, { $unset: { reminderAt: 1 } });
      scheduleNextReminder(id).catch((err) => {
        console.error(`[tasks/PATCH] Failed to schedule reminder for task ${id}:`, err);
      });
    }

    const sessionId = request.headers.get("X-Session-Id") ?? "";
    const targetUserIds = await getProjectMemberUserIds(task.projectId.toString());

    emitSyncEvent({
      entity: "task",
      action: "updated",
      userId: session.user.id,
      sessionId,
      entityId: task._id.toString(),
      projectId: task.projectId.toString(),
      targetUserIds,
      data: task.toJSON(),
      timestamp: Date.now(),
    });

    // If task is being completed and has recurrence, create the next occurrence
    if (
      result.data.completedAt &&
      task.recurrence?.frequency !== "none" &&
      task.dueDate
    ) {
      const nextDueDate = getNextDueDate(
        task.dueDate,
        task.recurrence.frequency,
        task.recurrence.interval ?? 1,
      );

      const shouldCreate =
        !task.recurrence.endDate || nextDueDate <= task.recurrence.endDate;

      if (shouldCreate) {
        const project = await Project.findById(task.projectId);
        const firstColumn = project?.columns
          ?.sort((a: { order: number }, b: { order: number }) => a.order - b.order)[0];

        if (firstColumn) {
          const taskCount = await Task.countDocuments({
            projectId: task.projectId,
            columnId: firstColumn.id,
            userId: session.user.id,
          });

          const newTask = await Task.create({
            title: task.title,
            description: task.description,
            projectId: task.projectId,
            userId: task.userId,
            columnId: firstColumn.id,
            priority: task.priority,
            dueDate: nextDueDate,
            recurrence: task.recurrence,
            order: taskCount,
            labels: task.labels,
            subtasks: task.subtasks.map((s) => ({
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

    return NextResponse.json(task);
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

  // Find task first to check membership
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
      { error: "Viewers cannot delete tasks" },
      { status: 403 },
    );
  }

  await Task.deleteOne({ _id: id });
  await Note.deleteMany({ taskId: id });

  const targetUserIds = await getProjectMemberUserIds(task.projectId.toString());
  emitSyncEvent({
    entity: "task",
    action: "deleted",
    userId: session.user.id,
    sessionId: request.headers.get("X-Session-Id") ?? "",
    entityId: id,
    projectId: task.projectId.toString(),
    targetUserIds,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}
