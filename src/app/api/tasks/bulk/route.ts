import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Note } from "@/models/note";
import { Notification } from "@/models/notification";
import { Project } from "@/models/project";
import { ProjectMember } from "@/models/project-member";
import { getProjectRole, getProjectMemberUserIds } from "@/lib/project-access";
import { Label } from "@/models/label";
import { emitSyncEvent } from "@/lib/event-bus";
import { getBlockerStatus } from "@/lib/task-dependencies";

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

      // Look up each project's columns to validate the target and to
      // determine completedAt from each project's own last column.
      const projects = await Project.find(
        { _id: { $in: [...accessibleProjectIds] } },
        { columns: 1 },
      );

      // Reject the move if any affected project lacks the target column —
      // otherwise those tasks would get an orphaned columnId and vanish.
      for (const project of projects) {
        if (!project.columns.some((c) => c.id === columnId)) {
          return NextResponse.json(
            {
              error: `Column '${columnId}' does not exist in one or more selected projects`,
            },
            { status: 400 },
          );
        }
      }

      const lastColumnByProject = new Map<string, string>();
      for (const project of projects) {
        const sorted = [...project.columns].sort((a, b) => a.order - b.order);
        if (sorted.length > 0) {
          lastColumnByProject.set(project._id.toString(), sorted[sorted.length - 1].id);
        }
      }

      // Group accessible tasks by project so we can conditionally set/clear completedAt
      const tasksByProject = new Map<string, string[]>();
      for (const t of tasks) {
        const pid = t.projectId.toString();
        if (!accessibleProjectIds.has(pid)) continue;
        if (!tasksByProject.has(pid)) tasksByProject.set(pid, []);
        tasksByProject.get(pid)!.push(t._id.toString());
      }

      // Tasks that still have open blockers must not be auto-completed on a
      // move to the last column (mirrors the single-task completion guard).
      const movingTasks = await Task.find({ _id: { $in: accessibleTaskIds } })
        .select("_id blockedBy")
        .lean();
      const blockerIds = [
        ...new Set(
          movingTasks.flatMap((t) => (t.blockedBy ?? []).map(String)),
        ),
      ];
      const blockerDocs = blockerIds.length
        ? await Task.find({ _id: { $in: blockerIds } })
            .select("_id completedAt archived")
            .lean()
        : [];
      const blockersById = new Map(
        blockerDocs.map((b) => [b._id.toString(), b]),
      );
      const blockedTaskIds = new Set(
        movingTasks
          .filter(
            (t) =>
              getBlockerStatus((t.blockedBy ?? []).map(String), blockersById)
                .openCount > 0,
          )
          .map((t) => t._id.toString()),
      );

      for (const [pid, tIds] of tasksByProject) {
        const lastCol = lastColumnByProject.get(pid);
        const isMovingToLastColumn = columnId === lastCol;
        const statusPush = {
          $push: { statusHistory: { columnId, timestamp: new Date() } },
        };

        if (!isMovingToLastColumn) {
          await Task.updateMany(
            { _id: { $in: tIds }, columnId: { $ne: columnId } },
            { $set: { columnId, completedAt: null }, ...statusPush },
          );
          continue;
        }

        // Moving to the done column: complete only the unblocked tasks.
        const completable = tIds.filter((id) => !blockedTaskIds.has(id));
        const blocked = tIds.filter((id) => blockedTaskIds.has(id));
        if (completable.length > 0) {
          await Task.updateMany(
            { _id: { $in: completable }, columnId: { $ne: columnId } },
            { $set: { columnId, completedAt: new Date() }, ...statusPush },
          );
        }
        if (blocked.length > 0) {
          await Task.updateMany(
            { _id: { $in: blocked }, columnId: { $ne: columnId } },
            { $set: { columnId, completedAt: null }, ...statusPush },
          );
        }
      }
    } else if (action === "priority") {
      if (!priority) {
        return NextResponse.json(
          { error: "priority required for priority action" },
          { status: 400 },
        );
      }
      await Task.updateMany(filter, { $set: { priority } });
    } else if (action === "delete") {
      const activeTimerTask = await Task.findOne({
        _id: { $in: accessibleTaskIds },
        timeSessions: { $elemMatch: { endedAt: null } },
      }).select("_id title").lean();
      if (activeTimerTask) {
        return NextResponse.json(
          { error: "Cannot delete tasks with an active time tracking session. Stop all timers first." },
          { status: 409 },
        );
      }
      await Note.deleteMany({ taskId: { $in: accessibleTaskIds } });
      await Notification.deleteMany({ taskId: { $in: accessibleTaskIds } });
      await Task.deleteMany(filter);
      // Remove deleted tasks from any remaining task's blockedBy.
      await Task.updateMany(
        { blockedBy: { $in: accessibleTaskIds } },
        { $pull: { blockedBy: { $in: accessibleTaskIds } } },
      );
    } else if (action === "archive") {
      const activeTimerTask = await Task.findOne({
        _id: { $in: accessibleTaskIds },
        timeSessions: { $elemMatch: { endedAt: null } },
      }).select("_id title").lean();
      if (activeTimerTask) {
        return NextResponse.json(
          { error: "Cannot archive tasks with an active time tracking session. Stop all timers first." },
          { status: 409 },
        );
      }
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
      // Validate label belongs to the session user — labels are user-scoped
      const validLabel = await Label.findOne({ _id: labelId, userId: session.user.id }).lean();
      if (!validLabel) {
        return NextResponse.json({ error: "Invalid label ID" }, { status: 400 });
      }
      await Task.updateMany(filter, { $addToSet: { labels: labelId } });
    }

    // Emit sync events for affected projects
    const sessionId = request.headers.get("X-Session-Id") ?? "";
    for (const pid of accessibleProjectIds) {
      const targetUserIds = await getProjectMemberUserIds(pid);
      emitSyncEvent({
        entity: "task",
        action: "reordered",
        userId: session.user.id,
        sessionId,
        entityId: "",
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
      await Notification.deleteMany({ taskId: { $in: matchingIds } });
      await Task.deleteMany({ _id: { $in: matchingIds } });
      // Remove deleted tasks from any remaining task's blockedBy.
      await Task.updateMany(
        { blockedBy: { $in: matchingIds } },
        { $pull: { blockedBy: { $in: matchingIds } } },
      );

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
