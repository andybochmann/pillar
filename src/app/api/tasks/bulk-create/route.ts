import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Task } from "@/models/task";
import { requireProjectRole, getProjectMemberUserIds } from "@/lib/project-access";

const BulkCreateSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1, "Title is required").max(200),
        description: z.string().max(2000).optional(),
        columnId: z.string().min(1, "Column is required"),
        priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
        subtasks: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              completed: z.boolean().optional(),
            }),
          )
          .max(50)
          .optional(),
      }),
    )
    .min(1, "At least one task is required")
    .max(20, "Maximum 20 tasks per request"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = BulkCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  const { projectId, tasks } = result.data;

  await connectDB();

  try {
    await requireProjectRole(session.user.id, projectId, "editor");
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status },
    );
  }

  try {
    const orderAgg = await Task.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: "$columnId", maxOrder: { $max: "$order" } } },
    ]);
    const maxOrders = new Map(
      orderAgg.map((row) => [row._id, row.maxOrder]),
    );

    const now = new Date();
    const taskDocs = tasks.map((task) => {
      const order = (maxOrders.get(task.columnId) ?? -1) + 1;
      maxOrders.set(task.columnId, order);

      return {
        title: task.title,
        description: task.description,
        projectId,
        userId: session.user.id,
        columnId: task.columnId,
        priority: task.priority ?? "medium",
        order,
        subtasks: task.subtasks ?? [],
        statusHistory: [{ columnId: task.columnId, timestamp: now }],
      };
    });

    const created = await Task.insertMany(taskDocs);

    const targetUserIds = await getProjectMemberUserIds(projectId);
    const sessionId = request.headers.get("X-Session-Id") ?? "";

    for (const task of created) {
      emitSyncEvent({
        entity: "task",
        action: "created",
        userId: session.user.id,
        sessionId,
        entityId: task._id.toString(),
        projectId,
        targetUserIds,
        data: task.toJSON(),
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({ tasks: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
