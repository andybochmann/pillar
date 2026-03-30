import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { Label } from "@/models/label";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { Note } from "@/models/note";
import { FilterPreset } from "@/models/filter-preset";
import { ProjectMember } from "@/models/project-member";
import { Notification } from "@/models/notification";
import { NotificationPreference } from "@/models/notification-preference";
import { getAccessibleProjectIds } from "@/lib/project-access";

const MetadataSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  user: z.object({
    name: z.string(),
    email: z.string(),
  }),
});

const CategoryBackupSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(50),
  color: z.string(),
  icon: z.string().optional(),
  order: z.number(),
  collapsed: z.boolean().optional().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const LabelBackupSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ColumnBackupSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

const ProjectBackupSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  categoryId: z.string(),
  columns: z.array(ColumnBackupSchema),
  viewType: z.enum(["board", "list"]).nullable().optional(),
  archived: z.boolean().optional().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SubtaskBackupSchema = z.object({
  title: z.string().min(1).max(200),
  completed: z.boolean(),
});

const RecurrenceBackupSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly", "none"]),
  interval: z.number().min(1),
  endDate: z.string().optional(),
});

const TimeSessionBackupSchema = z.object({
  startedAt: z.string(),
  endedAt: z.string().optional().nullable(),
});

const StatusHistoryBackupSchema = z.object({
  columnId: z.string(),
  timestamp: z.string(),
});

const TaskBackupSchema = z.object({
  _id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string(),
  columnId: z.string(),
  priority: z.enum(["urgent", "high", "medium", "low"]),
  dueDate: z.string().optional().nullable(),
  recurrence: RecurrenceBackupSchema.optional(),
  order: z.number(),
  labels: z.array(z.string()),
  subtasks: z.array(SubtaskBackupSchema),
  timeSessions: z.array(TimeSessionBackupSchema),
  statusHistory: z.array(StatusHistoryBackupSchema),
  reminderAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  archived: z.boolean().optional().default(false),
  archivedAt: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const DueDateReminderSchema = z.object({
  daysBefore: z.number().min(0).max(30),
  time: z.string().regex(/^([0-1]\d|2[0-3]):[0-5]\d$/),
});

const NotificationPreferenceBackupSchema = z
  .object({
    enableInAppNotifications: z.boolean().optional().default(true),
    enableBrowserPush: z.boolean().optional().default(false),
    quietHoursEnabled: z.boolean().optional().default(false),
    quietHoursStart: z.string().optional().default("22:00"),
    quietHoursEnd: z.string().optional().default("08:00"),
    enableOverdueSummary: z.boolean().optional().default(true),
    overdueSummaryTime: z.string().optional().default("09:00"),
    enableDailySummary: z.boolean().optional().default(true),
    dailySummaryTime: z.string().optional().default("09:00"),
    dueDateReminders: z
      .array(DueDateReminderSchema)
      .optional()
      .default([
        { daysBefore: 1, time: "09:00" },
        { daysBefore: 0, time: "08:00" },
      ]),
    timezone: z.string().optional().default("UTC"),
  })
  .passthrough();

const NoteBackupSchema = z.object({
  _id: z.string(),
  title: z.string().min(1).max(200),
  content: z.string().max(50000).optional().default(""),
  parentType: z.enum(["category", "project", "task"]),
  categoryId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  pinned: z.boolean().optional().default(false),
  order: z.number().optional().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const FilterPresetBackupSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(50),
  context: z.enum(["overview", "kanban"]),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  order: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const BackupSchema = z.object({
  metadata: MetadataSchema,
  categories: z.array(CategoryBackupSchema),
  labels: z.array(LabelBackupSchema),
  projects: z.array(ProjectBackupSchema),
  tasks: z.array(TaskBackupSchema),
  notes: z.array(NoteBackupSchema),
  filterPresets: z.array(FilterPresetBackupSchema).optional().default([]),
  notificationPreference: NotificationPreferenceBackupSchema.nullable(),
});

function stripFields(
  doc: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const result = { ...doc };
  for (const field of fields) {
    delete result[field];
  }
  return result;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const userId = session.user.id;

  const accessibleProjectIds = await getAccessibleProjectIds(userId);
  const [categories, labels, projects, tasks, notes, filterPresets, notifPref] =
    await Promise.all([
      Category.find({ userId }).lean(),
      Label.find({ userId }).lean(),
      Project.find({ userId }).lean(),
      Task.find({ projectId: { $in: accessibleProjectIds } }).lean(),
      Note.find({ userId }).lean(),
      FilterPreset.find({ userId }).lean(),
      NotificationPreference.findOne({ userId }).lean(),
    ]);

  const fieldsToStrip = ["userId", "__v"];

  const exportData = {
    metadata: {
      version: 1,
      exportedAt: new Date().toISOString(),
      user: {
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      },
    },
    categories: categories.map((c) =>
      stripFields(c as unknown as Record<string, unknown>, fieldsToStrip),
    ),
    labels: labels.map((l) =>
      stripFields(l as unknown as Record<string, unknown>, fieldsToStrip),
    ),
    projects: projects.map((p) =>
      stripFields(p as unknown as Record<string, unknown>, fieldsToStrip),
    ),
    tasks: tasks.map((t) => {
      const task = stripFields(
        t as unknown as Record<string, unknown>,
        fieldsToStrip,
      );
      if (Array.isArray(task.timeSessions)) {
        task.timeSessions = (
          task.timeSessions as Record<string, unknown>[]
        ).map((ts) => stripFields(ts, ["userId"]));
      }
      return task;
    }),
    notes: notes.map((n) =>
      stripFields(n as unknown as Record<string, unknown>, fieldsToStrip),
    ),
    filterPresets: filterPresets.map((fp) =>
      stripFields(fp as unknown as Record<string, unknown>, fieldsToStrip),
    ),
    notificationPreference: notifPref
      ? stripFields(
          notifPref as unknown as Record<string, unknown>,
          [...fieldsToStrip, "_id"],
        )
      : null,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="pillar-backup-${dateStr}.json"`,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = BackupSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  await connectDB();

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const data = result.data;

  // Collect existing document IDs before insertion (read-only — no data modified)
  const [oldLabels, oldCategories, oldProjects, oldTasks, oldNotes, oldFilterPresets] =
    await Promise.all([
      Label.find({ userId }, { _id: 1 }).lean(),
      Category.find({ userId }, { _id: 1 }).lean(),
      Project.find({ userId }, { _id: 1 }).lean(),
      Task.find({ projectId: { $in: await getAccessibleProjectIds(userId.toString()) } }, { _id: 1 }).lean(),
      Note.find({ userId }, { _id: 1 }).lean(),
      FilterPreset.find({ userId }, { _id: 1 }).lean(),
    ]);

  // Insert new data with fresh ObjectIds (no conflicts with existing data)
  // Labels have a unique compound index on {userId, name} — insert with a
  // temporary prefix to avoid conflicts, then rename after old labels are
  // cleaned up in the final batch.
  const LABEL_TEMP_PREFIX = `__restore_${Date.now()}_`;
  const labelMap = new Map<string, mongoose.Types.ObjectId>();
  const labelsToInsert = data.labels.map((l) => {
    const newId = new mongoose.Types.ObjectId();
    labelMap.set(l._id, newId);
    return {
      _id: newId,
      name: LABEL_TEMP_PREFIX + l.name,
      color: l.color,
      userId,
      createdAt: new Date(l.createdAt),
      updatedAt: new Date(l.updatedAt),
    };
  });

  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  const categoriesToInsert = data.categories.map((c) => {
    const newId = new mongoose.Types.ObjectId();
    categoryMap.set(c._id, newId);
    return {
      _id: newId,
      name: c.name,
      color: c.color,
      icon: c.icon,
      userId,
      order: c.order,
      collapsed: c.collapsed,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    };
  });

  const projectMap = new Map<string, mongoose.Types.ObjectId>();
  const mappedProjects = data.projects
    .map((p) => {
      const mappedCategoryId = categoryMap.get(p.categoryId);
      if (!mappedCategoryId) return null; // skip projects with unmapped categoryIds
      const newId = new mongoose.Types.ObjectId();
      projectMap.set(p._id, newId);
      return {
        _id: newId,
        name: p.name,
        description: p.description,
        categoryId: mappedCategoryId,
        userId,
        columns: p.columns,
        viewType: p.viewType ?? "board",
        archived: p.archived,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  const taskMap = new Map<string, mongoose.Types.ObjectId>();
  const mappedTasks = data.tasks
    .map((t) => {
      const mappedProjectId = projectMap.get(t.projectId);
      if (!mappedProjectId) return null; // skip tasks with unmapped projectIds
      const newId = new mongoose.Types.ObjectId();
      taskMap.set(t._id, newId);
      return {
        _id: newId,
        title: t.title,
        description: t.description,
        projectId: mappedProjectId,
        userId,
        columnId: t.columnId,
        priority: t.priority,
        dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
        recurrence: t.recurrence
          ? {
              frequency: t.recurrence.frequency,
              interval: t.recurrence.interval,
              endDate: t.recurrence.endDate
                ? new Date(t.recurrence.endDate)
                : undefined,
            }
          : undefined,
        order: t.order,
        labels: t.labels
          .map((lid) => labelMap.get(lid))
          .filter((id): id is mongoose.Types.ObjectId => id != null),
        subtasks: t.subtasks,
        timeSessions: t.timeSessions.map((ts) => ({
          startedAt: new Date(ts.startedAt),
          endedAt: ts.endedAt ? new Date(ts.endedAt) : undefined,
          userId,
        })),
        statusHistory: t.statusHistory.map((sh) => ({
          columnId: sh.columnId,
          timestamp: new Date(sh.timestamp),
        })),
        reminderAt: t.reminderAt ? new Date(t.reminderAt) : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
        archived: t.archived,
        archivedAt: t.archivedAt ? new Date(t.archivedAt) : undefined,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t != null);

  const mappedNotes = data.notes
    .map((n) => {
      const newId = new mongoose.Types.ObjectId();
      const doc: Record<string, unknown> = {
        _id: newId,
        title: n.title,
        content: n.content,
        parentType: n.parentType,
        userId,
        pinned: n.pinned,
        order: n.order,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
      };
      switch (n.parentType) {
        case "category":
          if (n.categoryId) {
            const mapped = categoryMap.get(n.categoryId);
            if (!mapped) return null; // skip notes with unmapped categoryId
            doc.categoryId = mapped;
          }
          break;
        case "project":
          if (n.projectId) {
            const mapped = projectMap.get(n.projectId);
            if (!mapped) return null; // skip notes with unmapped projectId
            doc.projectId = mapped;
          }
          break;
        case "task":
          if (n.projectId) {
            const mapped = projectMap.get(n.projectId);
            if (!mapped) return null; // skip notes with unmapped projectId
            doc.projectId = mapped;
          }
          if (n.taskId) {
            const mapped = taskMap.get(n.taskId);
            if (!mapped) return null; // skip notes with unmapped taskId
            doc.taskId = mapped;
          }
          break;
      }
      return doc;
    })
    .filter((n): n is NonNullable<typeof n> => n != null);

  const filterPresetsToInsert = data.filterPresets.map((fp) => ({
    _id: new mongoose.Types.ObjectId(),
    name: fp.name,
    userId,
    context: fp.context,
    filters: fp.filters,
    order: fp.order,
    createdAt: new Date(fp.createdAt),
    updatedAt: new Date(fp.updatedAt),
  }));

  // Execute inserts sequentially. On any failure, roll back all completed
  // inserts as compensating deletes (no transactions on standalone MongoDB).
  let labelsInserted = false;
  let categoriesInserted = false;
  let projectsInserted = false;
  let tasksInserted = false;
  let notesInserted = false;
  let filterPresetsInserted = false;

  try {
    if (labelsToInsert.length > 0) {
      await Label.insertMany(labelsToInsert);
      labelsInserted = true;
    }

    if (categoriesToInsert.length > 0) {
      await Category.insertMany(categoriesToInsert);
      categoriesInserted = true;
    }

    if (mappedProjects.length > 0) {
      await Project.insertMany(mappedProjects);
      projectsInserted = true;
      await ProjectMember.insertMany(
        mappedProjects.map((p) => ({
          projectId: p._id,
          userId,
          role: "owner",
          invitedBy: userId,
        })),
      );
    }

    if (mappedTasks.length > 0) {
      await Task.insertMany(mappedTasks);
      tasksInserted = true;
    }

    if (mappedNotes.length > 0) {
      await Note.insertMany(mappedNotes);
      notesInserted = true;
    }

    if (filterPresetsToInsert.length > 0) {
      await FilterPreset.insertMany(filterPresetsToInsert);
      filterPresetsInserted = true;
    }

    // Handle NotificationPreference (unique index on userId — delete before re-create)
    await NotificationPreference.deleteMany({ userId });
    if (data.notificationPreference) {
      const np = data.notificationPreference;
      await NotificationPreference.create({
        userId,
        enableInAppNotifications: np.enableInAppNotifications,
        enableBrowserPush: np.enableBrowserPush,
        quietHoursEnabled: np.quietHoursEnabled,
        quietHoursStart: np.quietHoursStart,
        quietHoursEnd: np.quietHoursEnd,
        enableOverdueSummary: np.enableOverdueSummary,
        overdueSummaryTime: np.overdueSummaryTime,
        enableDailySummary: np.enableDailySummary,
        dailySummaryTime: np.dailySummaryTime,
        dueDateReminders: np.dueDateReminders,
        timezone: np.timezone,
      });
    }
  } catch (insertErr) {
    // Compensating deletes — remove only what was successfully inserted
    const rollback: Promise<unknown>[] = [];
    if (labelsInserted)
      rollback.push(Label.deleteMany({ _id: { $in: labelsToInsert.map((l) => l._id) } }));
    if (categoriesInserted)
      rollback.push(Category.deleteMany({ _id: { $in: categoriesToInsert.map((c) => c._id) } }));
    if (projectsInserted) {
      const projIds = mappedProjects.map((p) => p._id);
      rollback.push(Project.deleteMany({ _id: { $in: projIds } }));
      rollback.push(ProjectMember.deleteMany({ projectId: { $in: projIds } }));
    }
    if (tasksInserted)
      rollback.push(Task.deleteMany({ _id: { $in: mappedTasks.map((t) => t._id) } }));
    if (notesInserted)
      rollback.push(Note.deleteMany({ _id: { $in: mappedNotes.map((n) => n._id as mongoose.Types.ObjectId) } }));
    if (filterPresetsInserted)
      rollback.push(FilterPreset.deleteMany({ _id: { $in: filterPresetsToInsert.map((fp) => fp._id) } }));
    await Promise.all(rollback);
    console.error("[backup/POST] Insert failed, rollback complete:", insertErr);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }

  // All inserts succeeded — safe to clean up old data (including labels)
  const oldProjectIds = oldProjects.map((d) => d._id);
  const oldTaskIds = oldTasks.map((d) => d._id);
  let cleanupFailed = false;
  try {
    await Promise.all([
      Label.deleteMany({ _id: { $in: oldLabels.map((d) => d._id) } }),
      Category.deleteMany({ _id: { $in: oldCategories.map((d) => d._id) } }),
      Project.deleteMany({ _id: { $in: oldProjectIds } }),
      // Also remove collaborator tasks in the user's old projects (different userId)
      Task.deleteMany({ projectId: { $in: oldProjectIds } }),
      Task.deleteMany({ _id: { $in: oldTaskIds } }),
      Notification.deleteMany({ taskId: { $in: oldTaskIds } }),
      Note.deleteMany({ _id: { $in: oldNotes.map((d) => d._id) } }),
      FilterPreset.deleteMany({ _id: { $in: oldFilterPresets.map((d) => d._id) } }),
      ProjectMember.deleteMany({ projectId: { $in: oldProjectIds } }),
    ]);
  } catch (cleanupErr) {
    console.error("[backup/POST] Cleanup of old data failed, attempting label rename:", cleanupErr);
    cleanupFailed = true;
  }

  // Always attempt to remove temporary prefix from restored label names,
  // even if cleanup failed, so labels are at least readable.
  if (data.labels.length > 0) {
    await Promise.all(
      data.labels.map((l) => {
        const newId = labelMap.get(l._id);
        if (!newId) return Promise.resolve();
        return Label.updateOne({ _id: newId }, { $set: { name: l.name } });
      }),
    );
  }

  return NextResponse.json({
    success: true,
    ...(cleanupFailed && { warning: "Restore succeeded but cleanup of old data failed. Some duplicate data may remain." }),
    summary: {
      categories: data.categories.length,
      labels: data.labels.length,
      projects: data.projects.length,
      tasks: data.tasks.length,
      notes: data.notes.length,
      filterPresets: data.filterPresets.length,
      notificationPreference: !!data.notificationPreference,
    },
  });
}
