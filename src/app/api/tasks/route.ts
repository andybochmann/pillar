import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { type SortOrder } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { ProjectMember } from "@/models/project-member";
import { startOfDay, endOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import {
  getAccessibleProjectIds,
  getProjectRole,
  getProjectMemberUserIds,
} from "@/lib/project-access";
import { scheduleNextReminder } from "@/lib/reminder-scheduler";

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
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        completed: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
  assigneeId: z.string().nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
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
  const search = searchParams.get("search");
  const priority = searchParams.get("priority");
  const dueDateFrom = searchParams.get("dueDateFrom");
  const dueDateTo = searchParams.get("dueDateTo");
  const labels = searchParams.get("labels");
  const completed = searchParams.get("completed");
  const assigneeId = searchParams.get("assigneeId");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder") === "desc" ? -1 : 1;

  const filter: Record<string, unknown> = {};

  if (projectId) {
    // Verify membership
    const role = await getProjectRole(session.user.id, projectId);
    if (!role) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    filter.projectId = projectId;
  } else {
    // All accessible projects
    const accessibleIds = await getAccessibleProjectIds(session.user.id);
    filter.projectId = {
      $in: accessibleIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  if (assigneeId) filter.assigneeId = assigneeId;
  if (columnId) filter.columnId = columnId;
  if (search) {
    filter.$text = { $search: search };
  }
  if (priority) filter.priority = { $in: priority.split(",") };
  if (labels) {
    filter.labels = {
      $in: labels.split(",").map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  if (dueDateFrom || dueDateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dueDateFrom) dateFilter.$gte = startOfDay(parseLocalDate(dueDateFrom));
    if (dueDateTo) dateFilter.$lte = endOfDay(parseLocalDate(dueDateTo));
    filter.dueDate = dateFilter;
  }

  if (completed === "true") {
    filter.completedAt = { $ne: null };
  } else if (completed === "false") {
    filter.completedAt = null;
  }

  if (sortBy === "priority") {
    const aggFilter: Record<string, unknown> = { ...filter };
    if (typeof filter.projectId === "string") {
      aggFilter.projectId = new mongoose.Types.ObjectId(filter.projectId);
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

    // Verify project membership (editor+ can create tasks)
    const role = await getProjectRole(session.user.id, result.data.projectId);
    if (!role) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (role === "viewer") {
      return NextResponse.json(
        { error: "Viewers cannot create tasks" },
        { status: 403 },
      );
    }

    // Validate assigneeId is a project member
    if (result.data.assigneeId) {
      const assigneeRole = await getProjectRole(
        result.data.assigneeId,
        result.data.projectId,
      );
      if (!assigneeRole) {
        return NextResponse.json(
          { error: "Assignee is not a project member" },
          { status: 400 },
        );
      }
    }

    const taskCount = await Task.countDocuments({
      projectId: result.data.projectId,
      columnId: result.data.columnId,
    });

    const taskData: Record<string, unknown> = {
      ...result.data,
      userId: session.user.id,
      order: result.data.order ?? taskCount,
      statusHistory: [
        { columnId: result.data.columnId, timestamp: new Date() },
      ],
    };

    if (result.data.dueDate) {
      taskData.dueDate = new Date(result.data.dueDate);
    }

    if (result.data.reminderAt) {
      taskData.reminderAt = new Date(result.data.reminderAt);
    }

    if (result.data.recurrence?.endDate) {
      taskData.recurrence = {
        ...result.data.recurrence,
        endDate: new Date(result.data.recurrence.endDate),
      };
    }

    if (result.data.assigneeId) {
      taskData.assigneeId = result.data.assigneeId;
    }

    const task = await Task.create(taskData);

    // Auto-schedule reminder from user's dueDateReminders preference
    // when task has a dueDate but no explicit reminderAt
    if (result.data.dueDate && !result.data.reminderAt) {
      scheduleNextReminder(task._id.toString()).catch((err) => {
        console.error(
          `[tasks/POST] Failed to schedule reminder for task ${task._id}:`,
          err,
        );
      });
    }

    const targetUserIds = await getProjectMemberUserIds(result.data.projectId);
    emitSyncEvent({
      entity: "task",
      action: "created",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: task._id.toString(),
      projectId: result.data.projectId,
      targetUserIds,
      data: task.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
