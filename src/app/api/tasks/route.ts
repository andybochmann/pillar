import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { type SortOrder } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { startOfDay, endOfDay } from "date-fns";

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
  const priority = searchParams.get("priority");
  const dueDateFrom = searchParams.get("dueDateFrom");
  const dueDateTo = searchParams.get("dueDateTo");
  const labels = searchParams.get("labels");
  const completed = searchParams.get("completed");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder") === "desc" ? -1 : 1;

  const filter: Record<string, unknown> = { userId: session.user.id };
  if (projectId) filter.projectId = projectId;
  if (columnId) filter.columnId = columnId;

  const search = searchParams.get("search");
  if (search) {
    filter.title = { $regex: search, $options: "i" };
  }

  if (priority) {
    const priorities = priority.split(",");
    filter.priority = { $in: priorities };
  }

  if (dueDateFrom || dueDateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dueDateFrom) dateFilter.$gte = startOfDay(new Date(dueDateFrom));
    if (dueDateTo) dateFilter.$lte = endOfDay(new Date(dueDateTo));
    filter.dueDate = dateFilter;
  }

  if (labels) {
    const labelList = labels.split(",");
    filter.labels = { $in: labelList };
  }

  if (completed === "true") {
    filter.completedAt = { $ne: null };
  } else if (completed === "false") {
    filter.completedAt = null;
  }

  // For priority sort, use aggregate for custom ordering
  if (sortBy === "priority") {
    // Aggregate doesn't auto-cast strings to ObjectId like find() does
    const aggFilter: Record<string, unknown> = {
      ...filter,
      userId: new mongoose.Types.ObjectId(session.user.id),
    };
    if (filter.projectId) {
      aggFilter.projectId = new mongoose.Types.ObjectId(
        filter.projectId as string,
      );
    }
    const tasks = await Task.aggregate([
      { $match: aggFilter },
      {
        $addFields: {
          priorityOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$priority", "urgent"] }, then: 0 },
                { case: { $eq: ["$priority", "high"] }, then: 1 },
                { case: { $eq: ["$priority", "medium"] }, then: 2 },
                { case: { $eq: ["$priority", "low"] }, then: 3 },
              ],
              default: 4,
            },
          },
        },
      },
      { $sort: { priorityOrder: sortOrder, order: 1 } },
      { $project: { priorityOrder: 0 } },
    ]);
    return NextResponse.json(tasks);
  }

  let sort: Record<string, SortOrder> = { order: 1 };
  if (sortBy === "dueDate") {
    sort = { dueDate: sortOrder, order: 1 };
  } else if (sortBy === "createdAt") {
    sort = { createdAt: sortOrder };
  }

  const tasks = await Task.find(filter).sort(sort);
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
