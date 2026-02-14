import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";

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
  const task = await Task.findOne({ _id: id, userId: session.user.id });

  if (!task) {
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

    const task = await Task.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      updateData,
      { returnDocument: "after" },
    );

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

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

          await Task.create({
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

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const task = await Task.findOneAndDelete({
    _id: id,
    userId: session.user.id,
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

function getNextDueDate(
  currentDate: Date,
  frequency: string,
  interval: number,
): Date {
  switch (frequency) {
    case "daily":
      return addDays(currentDate, interval);
    case "weekly":
      return addWeeks(currentDate, interval);
    case "monthly":
      return addMonths(currentDate, interval);
    case "yearly":
      return addYears(currentDate, interval);
    default:
      return currentDate;
  }
}
