import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";

const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().min(1, "Project is required"),
  columnId: z.string().min(1, "Column is required"),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  dueDate: z.string().datetime().optional(),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly", "none"]),
      interval: z.number().int().min(1).optional(),
      endDate: z.string().datetime().optional(),
    })
    .optional(),
  order: z.number().int().min(0).optional(),
  labels: z.array(z.string().max(50)).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const columnId = searchParams.get("columnId");

  const filter: Record<string, unknown> = { userId: session.user.id };
  if (projectId) filter.projectId = projectId;
  if (columnId) filter.columnId = columnId;

  const tasks = await Task.find(filter).sort({ order: 1 });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = CreateTaskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const taskCount = await Task.countDocuments({
      projectId: result.data.projectId,
      columnId: result.data.columnId,
      userId: session.user.id,
    });

    const task = await Task.create({
      ...result.data,
      userId: session.user.id,
      dueDate: result.data.dueDate ? new Date(result.data.dueDate) : undefined,
      recurrence: result.data.recurrence
        ? {
            ...result.data.recurrence,
            endDate: result.data.recurrence.endDate
              ? new Date(result.data.recurrence.endDate)
              : undefined,
          }
        : undefined,
      order: result.data.order ?? taskCount,
    });

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
