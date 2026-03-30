import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { type SortOrder } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { ProjectMember } from "@/models/project-member";
import { Label } from "@/models/label";
import { startOfDayUTC, endOfDayUTC } from "@/lib/date-utils";
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
    if (dueDateFrom) dateFilter.$gte = startOfDayUTC(dueDateFrom);
    if (dueDateTo) dateFilter.$lte = endOfDayUTC(dueDateTo);
    filter.dueDate = dateFilter;
  }

  if (completed === "true") {
    filter.completedAt = { $ne: null };
  } else if (completed === "false") {
    filter.completedAt = null;
  }

  // Archive filtering
  const archived = searchParams.get("archived");
  if (archived === "true") {
    filter.archived = true;
  } else {
    filter.archived = { $ne: true };
  }

  if (sortBy === "priority") {
    const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const tasks = await Task.find(filter).lean();
    tasks.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 4;
      const pb = PRIORITY_ORDER[b.priority] ?? 4;
      const diff = (pa - pb) * sortOrder;
      return diff !== 0 ? diff : (a.order - b.order);
    });
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

    // Validate label ownership — labels are user-scoped
    if (result.data.labels && result.data.labels.length > 0) {
      const validLabels = await Label.find({
        _id: { $in: result.data.labels },
        userId: session.user.id,
      }).select("_id").lean();
      if (validLabels.length !== result.data.labels.length) {
        return NextResponse.json({ error: "Invalid label IDs" }, { status: 400 });
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
