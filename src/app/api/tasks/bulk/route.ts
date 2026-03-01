import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Note } from "@/models/note";
import { ProjectMember } from "@/models/project-member";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";
import { emitSyncEvent } from "@/lib/event-bus";

const BulkUpdateSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1, "At least one task ID required").max(500),
  action: z.enum([
    "move",
    "priority",
    "delete",
    "archive",
    "set-due-date",
    "assign",
    "add-label",
  ]),
  columnId: z.string().min(1).optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().nullable().optional(),
  labelId: z.string().min(1).optional(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = BulkUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const { taskIds, action, columnId, priority, dueDate, assigneeId, labelId } =
      result.data;

    // Verify all tasks exist and user has access
    const tasks = await Task.find({ _id: { $in: taskIds } }, { projectId: 1 });
    if (tasks.length === 0) {
      // No valid tasks found — nothing to do
      return NextResponse.json({ success: true });
    }

    // Verify membership on each unique project — filter to accessible tasks only
    // Viewers are excluded (they cannot mutate tasks)
    const accessibleTaskIds: string[] = [];
    const projectIds = [...new Set(tasks.map((t) => t.projectId.toString()))];
    const accessibleProjectIds = new Set<string>();
    for (const pid of projectIds) {
      const role = await getProjectRole(session.user.id, pid);
      if (role && role !== "viewer") accessibleProjectIds.add(pid);
    }
    for (const t of tasks) {
      if (accessibleProjectIds.has(t.projectId.toString())) {
        accessibleTaskIds.push(t._id.toString());
      }
    }

    if (accessibleTaskIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const filter = { _id: { $in: accessibleTaskIds } };

    if (action === "move") {
      if (!columnId) {
        return NextResponse.json(
          { error: "columnId required for move action" },
          { status: 400 },
        );
      }

      await Task.updateMany(
        { ...filter, columnId: { $ne: columnId } },
        {
          $set: { columnId },
          $push: { statusHistory: { columnId, timestamp: new Date() } },
        },
      );
    } else if (action === "priority") {
      if (!priority) {
        return NextResponse.json(
          { error: "priority required for priority action" },
          { status: 400 },
        );
      }
      await Task.updateMany(filter, { $set: { priority } });
    } else if (action === "delete") {
      await Note.deleteMany({ taskId: { $in: accessibleTaskIds } });
      await Task.deleteMany(filter);
    } else if (action === "archive") {
      await Task.updateMany(filter, {
        $set: { archived: true, archivedAt: new Date() },
      });
    } else if (action === "set-due-date") {
      if (!dueDate) {
        return NextResponse.json(
          { error: "dueDate required for set-due-date action" },
          { status: 400 },
        );
      }
      await Task.updateMany(filter, { $set: { dueDate: new Date(dueDate) } });
    } else if (action === "assign") {
      if (assigneeId === undefined) {
        return NextResponse.json(
          { error: "assigneeId required for assign action" },
          { status: 400 },
        );
      }
      if (assigneeId === null) {
        await Task.updateMany(filter, { $unset: { assigneeId: "" } });
      } else {
        // Validate assignee is a member of all affected projects
        for (const pid of accessibleProjectIds) {
          const isMember = await ProjectMember.findOne({
            projectId: pid,
            userId: assigneeId,
          });
          if (!isMember) {
            return NextResponse.json(
              { error: "Assignee is not a member of the project" },
              { status: 400 },
            );
          }
        }
        await Task.updateMany(filter, { $set: { assigneeId } });
      }
    } else if (action === "add-label") {
      if (!labelId) {
        return NextResponse.json(
          { error: "labelId required for add-label action" },
          { status: 400 },
        );
      }
      await Task.updateMany(filter, { $addToSet: { labels: labelId } });
    }

    // Emit sync events for affected projects
    const sessionId = request.headers.get("X-Session-Id") ?? "";
    for (const pid of accessibleProjectIds) {
      const targetUserIds = await getProjectMemberUserIds(pid);
      emitSyncEvent({
        entity: "task",
        action: action === "delete" ? "deleted" : "updated",
        userId: session.user.id,
        sessionId,
        entityId: pid,
        projectId: pid,
        targetUserIds,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const BulkDeleteArchivedSchema = z.object({
  projectId: z.string().min(1),
  taskIds: z.array(z.string().min(1)).optional(),
  olderThanDays: z.number().int().min(1).optional(),
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = BulkDeleteArchivedSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const { projectId, taskIds, olderThanDays } = result.data;

    // Verify user has editor+ role on the project
    const role = await getProjectRole(session.user.id, projectId);
    if (!role || role === "viewer") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      );
    }

    // Build filter: always scoped to project + archived only
    const filter: Record<string, unknown> = {
      projectId,
      archived: true,
    };

    if (taskIds) {
      filter._id = { $in: taskIds };
    }

    if (olderThanDays) {
      const cutoff = new Date(
        Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
      );
      filter.archivedAt = { $lt: cutoff };
    }

    // Find matching task IDs for note cascade
    const matchingTasks = await Task.find(filter, { _id: 1 });
    const matchingIds = matchingTasks.map((t) => t._id.toString());

    if (matchingIds.length > 0) {
      await Note.deleteMany({ taskId: { $in: matchingIds } });
      await Task.deleteMany({ _id: { $in: matchingIds } });

      const targetUserIds = await getProjectMemberUserIds(projectId);
      emitSyncEvent({
        entity: "task",
        action: "deleted",
        userId: session.user.id,
        sessionId: request.headers.get("X-Session-Id") ?? "",
        entityId: projectId,
        projectId,
        targetUserIds,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      deletedCount: matchingIds.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
