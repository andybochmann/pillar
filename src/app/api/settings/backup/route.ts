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
import { NotificationPreference } from "@/models/notification-preference";

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

  const [categories, labels, projects, tasks, notes, filterPresets, notifPref] =
    await Promise.all([
      Category.find({ userId }).lean(),
      Label.find({ userId }).lean(),
      Project.find({ userId }).lean(),
      Task.find({ userId }).lean(),
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
      Task.find({ userId }, { _id: 1 }).lean(),
      Note.find({ userId }, { _id: 1 }).lean(),
      FilterPreset.find({ userId }, { _id: 1 }).lean(),
    ]);

  // Labels have a unique compound index on {userId, name} — must delete old
  // labels before inserting new ones to avoid duplicate key conflicts.
  await Label.deleteMany({ _id: { $in: oldLabels.map((d) => d._id) } });

  // Insert new data with fresh ObjectIds (no conflicts with existing data)
  const labelMap = new Map<string, mongoose.Types.ObjectId>();
  await Label.insertMany(
    data.labels.map((l) => {
      const newId = new mongoose.Types.ObjectId();
      labelMap.set(l._id, newId);
      return {
        _id: newId,
        name: l.name,
        color: l.color,
        userId,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      };
    }),
  );

  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  await Category.insertMany(
    data.categories.map((c) => {
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
    }),
  );

  const projectMap = new Map<string, mongoose.Types.ObjectId>();
  await Project.insertMany(
    data.projects.map((p) => {
      const newId = new mongoose.Types.ObjectId();
      projectMap.set(p._id, newId);
      return {
        _id: newId,
        name: p.name,
        description: p.description,
        categoryId: categoryMap.get(p.categoryId) ?? p.categoryId,
        userId,
        columns: p.columns,
        viewType: p.viewType ?? "board",
        archived: p.archived,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      };
    }),
  );

  const taskMap = new Map<string, mongoose.Types.ObjectId>();
  await Task.insertMany(
    data.tasks.map((t) => {
      const newId = new mongoose.Types.ObjectId();
      taskMap.set(t._id, newId);
      return {
        _id: newId,
        title: t.title,
        description: t.description,
        projectId: projectMap.get(t.projectId) ?? t.projectId,
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
        labels: t.labels.map((lid) => labelMap.get(lid) ?? lid),
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
    }),
  );

  await Note.insertMany(
    data.notes.map((n) => {
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
          doc.categoryId = n.categoryId
            ? (categoryMap.get(n.categoryId) ?? n.categoryId)
            : undefined;
          break;
        case "project":
          doc.projectId = n.projectId
            ? (projectMap.get(n.projectId) ?? n.projectId)
            : undefined;
          break;
        case "task":
          doc.projectId = n.projectId
            ? (projectMap.get(n.projectId) ?? n.projectId)
            : undefined;
          doc.taskId = n.taskId
            ? (taskMap.get(n.taskId) ?? n.taskId)
            : undefined;
          break;
      }
      return doc;
    }),
  );

  if (data.filterPresets.length > 0) {
    await FilterPreset.insertMany(
      data.filterPresets.map((fp) => ({
        _id: new mongoose.Types.ObjectId(),
        name: fp.name,
        userId,
        context: fp.context,
        filters: fp.filters,
        order: fp.order,
        createdAt: new Date(fp.createdAt),
        updatedAt: new Date(fp.updatedAt),
      })),
    );
  }

  // All inserts succeeded — safe to clean up old data
  // Handle NotificationPreference first (unique index on userId)
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

  // Delete old documents by their collected IDs (labels already deleted above)
  await Promise.all([
    Category.deleteMany({ _id: { $in: oldCategories.map((d) => d._id) } }),
    Project.deleteMany({ _id: { $in: oldProjects.map((d) => d._id) } }),
    Task.deleteMany({ _id: { $in: oldTasks.map((d) => d._id) } }),
    Note.deleteMany({ _id: { $in: oldNotes.map((d) => d._id) } }),
    FilterPreset.deleteMany({ _id: { $in: oldFilterPresets.map((d) => d._id) } }),
  ]);

  return NextResponse.json({
    success: true,
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
