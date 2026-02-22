import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Notification } from "@/models/notification";
import {
  NotificationPreference,
  type INotificationPreference,
} from "@/models/notification-preference";
import { emitNotificationEvent } from "@/lib/event-bus";
import { isWithinQuietHours } from "@/lib/notification-scheduler";
import { sendPushToUser } from "@/lib/web-push";
import { scheduleNextReminder } from "@/lib/reminder-scheduler";

const WORKER_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

declare global {
  var notificationWorkerStarted: boolean | undefined;
  var notificationWorkerInterval: ReturnType<typeof setInterval> | undefined;
}

/**
 * Check if notifications should be skipped for a user based on preferences.
 * Uses already-loaded preferences to avoid per-task DB queries.
 */
function shouldSkipUser(
  prefs: INotificationPreference | undefined,
  now: Date,
  options?: { requireOverdueEnabled?: boolean },
): boolean {
  if (!prefs) return true;
  const notificationsEnabled =
    prefs.enableInAppNotifications || prefs.enableBrowserPush;
  if (!notificationsEnabled) return true;
  if (options?.requireOverdueEnabled && !prefs.enableOverdueSummary)
    return true;
  return isWithinQuietHours(
    now,
    prefs.quietHoursEnabled,
    prefs.quietHoursStart,
    prefs.quietHoursEnd,
    prefs.timezone || "UTC",
  );
}

/**
 * Batch-load preferences for a set of user IDs.
 * Auto-creates default preference records for users that don't have one yet,
 * so notifications work out of the box without requiring a settings page visit.
 */
async function loadPreferencesMap(
  userIds: mongoose.Types.ObjectId[],
): Promise<Map<string, INotificationPreference>> {
  if (userIds.length === 0) return new Map();
  const prefs = await NotificationPreference.find({ userId: { $in: userIds } });
  const map = new Map(prefs.map((p) => [p.userId.toString(), p]));

  // Auto-create default preferences for users missing records
  const missingIds = userIds.filter((id) => !map.has(id.toString()));
  if (missingIds.length > 0) {
    const created = await Promise.all(
      missingIds.map((userId) =>
        NotificationPreference.create({ userId }).catch((err) => {
          // Unique constraint race: another worker beat us to it
          if ((err as { code?: number }).code === 11000) {
            return NotificationPreference.findOne({ userId });
          }
          console.error(
            `[notification-worker] Failed to create default preferences for user ${userId}:`,
            err,
          );
          return null;
        }),
      ),
    );
    for (const pref of created) {
      if (pref) map.set(pref.userId.toString(), pref);
    }
  }

  return map;
}

/** Push actions for single-task notifications (reminder/overdue). */
const TASK_PUSH_ACTIONS = [
  { action: "complete", title: "Mark Complete" },
  { action: "snooze", title: "Snooze 1 Day" },
];

/**
 * Emit a notification SSE event and optionally send a web push notification.
 */
function emitNotification(
  notification: InstanceType<typeof Notification>,
  userId: string,
  taskId?: string,
  pushEnabled?: boolean,
  projectId?: string,
  notificationType?: string,
): void {
  const notificationId = notification._id.toString();
  const tag = `pillar-${notificationId}`;

  emitNotificationEvent({
    type: notification.type,
    notificationId,
    userId,
    taskId,
    title: notification.title,
    message: notification.message,
    metadata: notification.metadata as Record<string, unknown>,
    timestamp: Date.now(),
  });

  if (pushEnabled) {
    // Include action buttons for single-task notifications (reminder/overdue)
    const isSingleTask =
      notificationType === "reminder" || notificationType === "overdue";

    sendPushToUser(userId, {
      title: notification.title,
      message: notification.message,
      notificationId,
      taskId,
      tag,
      url: projectId ? `/projects/${projectId}` : "/",
      ...(isSingleTask && {
        actions: TASK_PUSH_ACTIONS,
        notificationType,
      }),
    }).catch((err) => {
      console.error(
        `[notification-worker] Push failed for user ${userId}:`,
        err,
      );
    });
  }
}

/**
 * Collect unique user IDs from tasks (owners + assignees).
 */
function collectUserIds(
  tasks: Array<{
    userId: mongoose.Types.ObjectId;
    assigneeId?: mongoose.Types.ObjectId | null;
  }>,
): mongoose.Types.ObjectId[] {
  const seen = new Set<string>();
  const ids: mongoose.Types.ObjectId[] = [];
  for (const task of tasks) {
    const ownerId = task.userId.toString();
    if (!seen.has(ownerId)) {
      seen.add(ownerId);
      ids.push(task.userId);
    }
    if (task.assigneeId) {
      const assigneeId = task.assigneeId.toString();
      if (!seen.has(assigneeId)) {
        seen.add(assigneeId);
        ids.push(task.assigneeId);
      }
    }
  }
  return ids;
}

/**
 * Get user IDs to notify for a task (owner + assignee if different).
 */
function getUsersToNotify(task: {
  userId: mongoose.Types.ObjectId;
  assigneeId?: mongoose.Types.ObjectId | null;
}): string[] {
  const users = [task.userId.toString()];
  if (
    task.assigneeId &&
    task.assigneeId.toString() !== task.userId.toString()
  ) {
    users.push(task.assigneeId.toString());
  }
  return users;
}

/**
 * Get the start (midnight) or end (23:59:59.999) of a day in UTC.
 */
function getDayBoundaryUTC(date: Date, boundary: "start" | "end"): Date {
  const d = new Date(date);
  if (boundary === "start") {
    d.setUTCHours(0, 0, 0, 0);
  } else {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

/**
 * Convert a Date to total minutes since midnight in the given IANA timezone.
 */
function getMinutesInTimezone(date: Date, timezone: string): number {
  const timeStr = date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Get the calendar date string (YYYY-MM-DD) for a Date in the given timezone.
 */
function getDateStringInTimezone(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * Process pending reminder notifications (tasks with reminderAt <= now).
 * Creates notifications for task owner and assignee, clears reminderAt (one-shot).
 */
async function processReminders(
  now: Date,
  scopeUserId?: string,
): Promise<number> {
  let created = 0;

  const taskFilter: Record<string, unknown> = {
    reminderAt: { $lte: now },
    completedAt: null,
  };
  if (scopeUserId) {
    taskFilter.$or = [{ userId: scopeUserId }, { assigneeId: scopeUserId }];
  }

  const tasks = await Task.find(taskFilter);
  if (tasks.length === 0) return 0;

  // Batch-load preferences
  const userIds = collectUserIds(tasks);
  const prefsMap = await loadPreferencesMap(userIds);

  // Batch-load existing reminder notifications for dedup
  const taskIds = tasks.map((t) => t._id);
  const existingReminders = await Notification.find({
    taskId: { $in: taskIds },
    type: "reminder",
  });
  const existingSet = new Set(
    existingReminders.map(
      (n) =>
        `${n.taskId?.toString()}_${n.userId.toString()}_${n.scheduledFor?.toISOString()}`,
    ),
  );

  for (const task of tasks) {
    const taskId = task._id.toString();
    const usersToNotify = getUsersToNotify(task);

    for (const userId of usersToNotify) {
      const prefs = prefsMap.get(userId);
      if (shouldSkipUser(prefs, now)) continue;

      const dedupKey = `${taskId}_${userId}_${task.reminderAt?.toISOString()}`;
      if (existingSet.has(dedupKey)) continue;

      const notification = await Notification.create({
        userId,
        taskId: task._id,
        type: "reminder",
        title: "Task reminder",
        message: `"${task.title}" needs your attention.`,
        scheduledFor: task.reminderAt,
        metadata: {
          priority: task.priority,
          dueDate: task.dueDate?.toISOString(),
          projectId: task.projectId.toString(),
        },
      });

      emitNotification(
        notification,
        userId,
        taskId,
        prefs?.enableBrowserPush,
        task.projectId.toString(),
        "reminder",
      );
      created++;
    }

    // Clear reminderAt (one-shot) then schedule next timing
    await Task.updateOne({ _id: task._id }, { $unset: { reminderAt: 1 } });
    scheduleNextReminder(taskId).catch((err) => {
      console.error(
        `[notification-worker] Failed to schedule next reminder for task ${taskId}:`,
        err,
      );
    });
  }

  return created;
}

/**
 * Process overdue task notifications.
 * Creates notifications for task owner and assignee if they don't already have one.
 */
async function processOverdue(
  now: Date,
  scopeUserId?: string,
): Promise<number> {
  let created = 0;

  const taskFilter: Record<string, unknown> = {
    dueDate: { $lt: now },
    completedAt: null,
  };
  if (scopeUserId) {
    taskFilter.$or = [{ userId: scopeUserId }, { assigneeId: scopeUserId }];
  }

  const tasks = await Task.find(taskFilter);
  if (tasks.length === 0) return 0;

  // Batch-load preferences
  const userIds = collectUserIds(tasks);
  const prefsMap = await loadPreferencesMap(userIds);

  // Batch-load existing overdue notifications for dedup
  const taskIds = tasks.map((t) => t._id);
  const existingOverdue = await Notification.find({
    taskId: { $in: taskIds },
    type: "overdue",
  });
  const existingSet = new Set(
    existingOverdue.map(
      (n) => `${n.taskId?.toString()}_${n.userId.toString()}`,
    ),
  );

  for (const task of tasks) {
    const taskId = task._id.toString();
    const usersToNotify = getUsersToNotify(task);

    for (const userId of usersToNotify) {
      const prefs = prefsMap.get(userId);
      if (shouldSkipUser(prefs, now, { requireOverdueEnabled: true })) continue;

      const dedupKey = `${taskId}_${userId}`;
      if (existingSet.has(dedupKey)) continue;

      const notification = await Notification.create({
        userId,
        taskId: task._id,
        type: "overdue",
        title: "Task is overdue",
        message: `"${task.title}" is overdue and needs your attention.`,
        metadata: {
          priority: task.priority,
          dueDate: task.dueDate!.toISOString(),
          projectId: task.projectId.toString(),
        },
      });

      emitNotification(
        notification,
        userId,
        taskId,
        prefs?.enableBrowserPush,
        task.projectId.toString(),
        "overdue",
      );
      created++;
    }
  }

  return created;
}

/**
 * Process daily summary notifications.
 * For each user with enableDailySummary, checks:
 * 1. Current time in user's timezone is at or past dailySummaryTime
 * 2. No daily-summary sent yet for today (in user's timezone)
 * 3. There are due-today or overdue tasks (owner or assignee)
 */
export async function processDailySummary(
  now: Date,
  scopeUserId?: string,
): Promise<number> {
  let created = 0;

  const prefFilter: Record<string, unknown> = {
    enableDailySummary: true,
    $or: [{ enableInAppNotifications: true }, { enableBrowserPush: true }],
  };
  if (scopeUserId) {
    prefFilter.userId = scopeUserId;
  }

  const prefs = await NotificationPreference.find(prefFilter);

  // Batch-load existing daily summaries from last 36 hours for dedup
  const recentCutoff = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const prefUserIds = prefs.map((p) => p.userId);
  const existingSummaries = await Notification.find({
    userId: { $in: prefUserIds },
    type: "daily-summary",
    createdAt: { $gte: recentCutoff },
  });

  // Map userId → Set of summaryDate strings for dedup
  const summaryDates = new Map<string, Set<string>>();
  for (const s of existingSummaries) {
    const uid = s.userId.toString();
    if (!summaryDates.has(uid)) summaryDates.set(uid, new Set());
    const dateStr = (s.metadata as Record<string, unknown>)
      ?.summaryDate as string;
    if (dateStr) summaryDates.get(uid)!.add(dateStr);
  }

  for (const pref of prefs) {
    const userId = pref.userId.toString();
    const timezone = pref.timezone || "UTC";

    // Check if current time is at or past the configured summary time
    const currentMinutes = getMinutesInTimezone(now, timezone);
    const [summaryHour, summaryMinute] = pref.dailySummaryTime
      .split(":")
      .map(Number);
    const summaryMinutes = summaryHour * 60 + summaryMinute;
    if (currentMinutes < summaryMinutes) continue;

    // Check quiet hours (timezone-aware)
    if (
      isWithinQuietHours(
        now,
        pref.quietHoursEnabled,
        pref.quietHoursStart,
        pref.quietHoursEnd,
        timezone,
      )
    ) {
      continue;
    }

    // Check if we already sent a daily summary for today (in user's timezone)
    const todayStr = getDateStringInTimezone(now, timezone);
    if (summaryDates.get(userId)?.has(todayStr)) continue;

    // Compute "today" boundaries in UTC based on the user's local calendar date.
    // Due dates are stored as midnight UTC, so we match on the UTC date
    // that corresponds to "today" in the user's timezone.
    const todayStart = new Date(todayStr + "T00:00:00.000Z");
    const todayEnd = new Date(todayStr + "T23:59:59.999Z");

    // Find tasks where user is owner OR assignee, due today
    const dueTodayTasks = await Task.find({
      $or: [{ userId: pref.userId }, { assigneeId: pref.userId }],
      dueDate: { $gte: todayStart, $lte: todayEnd },
      completedAt: null,
    });

    // Find overdue tasks
    const overdueTasks = await Task.find({
      $or: [{ userId: pref.userId }, { assigneeId: pref.userId }],
      dueDate: { $lt: todayStart },
      completedAt: null,
    });

    const dueTodayCount = dueTodayTasks.length;
    const overdueCount = overdueTasks.length;
    const totalCount = dueTodayCount + overdueCount;

    // Only send if there are due or overdue tasks
    if (totalCount === 0) continue;

    const parts: string[] = [];
    if (dueTodayCount > 0) {
      parts.push(
        `${dueTodayCount} task${dueTodayCount === 1 ? "" : "s"} due today`,
      );
    }
    if (overdueCount > 0) {
      parts.push(
        `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}`,
      );
    }

    const notification = await Notification.create({
      userId: pref.userId,
      type: "daily-summary",
      title: "Daily Summary",
      message: `You have ${parts.join(" and ")}.`,
      metadata: {
        summaryDate: todayStr,
        dueTodayCount,
        overdueCount,
        totalCount,
        dueTodayTasks: dueTodayTasks.slice(0, 5).map((t) => ({
          id: t._id.toString(),
          title: t.title,
          priority: t.priority,
          projectId: t.projectId.toString(),
        })),
        overdueTasks: overdueTasks.slice(0, 5).map((t) => ({
          id: t._id.toString(),
          title: t.title,
          priority: t.priority,
          projectId: t.projectId.toString(),
        })),
      },
    });

    emitNotification(notification, userId, undefined, pref.enableBrowserPush);
    created++;
  }

  return created;
}

/**
 * Process overdue digest notifications.
 * For each user with enableOverdueSummary, checks:
 * 1. Current time in user's timezone is at or past overdueSummaryTime
 * 2. No overdue-digest sent yet for today (in user's timezone)
 * 3. There are overdue tasks (owner or assignee)
 * Creates a single aggregated notification with count + task previews.
 */
export async function processOverdueDigest(
  now: Date,
  scopeUserId?: string,
): Promise<number> {
  let created = 0;

  const prefFilter: Record<string, unknown> = {
    enableOverdueSummary: true,
    $or: [{ enableInAppNotifications: true }, { enableBrowserPush: true }],
  };
  if (scopeUserId) {
    prefFilter.userId = scopeUserId;
  }

  const prefs = await NotificationPreference.find(prefFilter);

  // Batch-load existing overdue digests from last 36 hours for dedup
  const recentCutoff = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const prefUserIds = prefs.map((p) => p.userId);
  const existingDigests = await Notification.find({
    userId: { $in: prefUserIds },
    type: "overdue-digest",
    createdAt: { $gte: recentCutoff },
  });

  // Map userId → Set of overdueSummaryDate strings for dedup
  const digestDates = new Map<string, Set<string>>();
  for (const d of existingDigests) {
    const uid = d.userId.toString();
    if (!digestDates.has(uid)) digestDates.set(uid, new Set());
    const dateStr = (d.metadata as Record<string, unknown>)
      ?.overdueSummaryDate as string;
    if (dateStr) digestDates.get(uid)!.add(dateStr);
  }

  for (const pref of prefs) {
    const userId = pref.userId.toString();
    const timezone = pref.timezone || "UTC";

    // Check if current time is at or past the configured overdue summary time
    const currentMinutes = getMinutesInTimezone(now, timezone);
    const summaryTime = pref.overdueSummaryTime || "09:00";
    const [summaryHour, summaryMinute] = summaryTime.split(":").map(Number);
    const summaryMinutes = summaryHour * 60 + summaryMinute;
    if (currentMinutes < summaryMinutes) continue;

    // Check quiet hours (timezone-aware)
    if (
      isWithinQuietHours(
        now,
        pref.quietHoursEnabled,
        pref.quietHoursStart,
        pref.quietHoursEnd,
        timezone,
      )
    ) {
      continue;
    }

    // Check if we already sent an overdue digest for today (in user's timezone)
    const todayStr = getDateStringInTimezone(now, timezone);
    if (digestDates.get(userId)?.has(todayStr)) continue;

    // Compute "today" start in UTC based on the user's local calendar date
    const todayStart = new Date(todayStr + "T00:00:00.000Z");

    // Find overdue tasks where user is owner OR assignee
    const overdueTasks = await Task.find({
      $or: [{ userId: pref.userId }, { assigneeId: pref.userId }],
      dueDate: { $lt: todayStart },
      completedAt: null,
    }).sort({ dueDate: 1 });

    const overdueCount = overdueTasks.length;
    if (overdueCount === 0) continue;

    // Build task previews with days overdue (up to 10)
    const taskPreviews = overdueTasks.slice(0, 10).map((t) => {
      const daysOverdue = Math.floor(
        (todayStart.getTime() - t.dueDate!.getTime()) / (24 * 60 * 60 * 1000),
      );
      return {
        id: t._id.toString(),
        title: t.title,
        priority: t.priority,
        projectId: t.projectId.toString(),
        dueDate: t.dueDate!.toISOString(),
        daysOverdue,
      };
    });

    // Build message
    const taskList = taskPreviews
      .slice(0, 5)
      .map((t) => `${t.title} (${t.daysOverdue}d overdue)`)
      .join(", ");
    const message =
      overdueCount <= 5
        ? `You have ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}: ${taskList}`
        : `You have ${overdueCount} overdue tasks: ${taskList}, and ${overdueCount - 5} more`;

    const notification = await Notification.create({
      userId: pref.userId,
      type: "overdue-digest",
      title: "Overdue Tasks Summary",
      message,
      metadata: {
        overdueSummaryDate: todayStr,
        overdueCount,
        tasks: taskPreviews,
      },
    });

    emitNotification(notification, userId, undefined, pref.enableBrowserPush);
    created++;
  }

  return created;
}

/**
 * Main notification processing function.
 * Called by the interval worker (no userId = all users) and the
 * manual check-due-dates endpoint (with userId = scoped to that user).
 */
export async function processNotifications(scopeUserId?: string): Promise<{
  reminders: number;
  overdue: number;
  dailySummaries: number;
  overdueDigests: number;
}> {
  await connectDB();
  const now = new Date();

  const reminders = await processReminders(now, scopeUserId);
  const overdue = await processOverdue(now, scopeUserId);
  const dailySummaries = await processDailySummary(now, scopeUserId);
  const overdueDigests = await processOverdueDigest(now, scopeUserId);

  const total = reminders + overdue + dailySummaries + overdueDigests;
  if (total > 0) {
    console.log(`[notification-worker] Created ${total} notifications`, {
      reminders,
      overdue,
      dailySummaries,
      overdueDigests,
    });
  }

  return { reminders, overdue, dailySummaries, overdueDigests };
}

/**
 * Start the background notification worker.
 * Uses a global guard to prevent multiple intervals in HMR.
 */
export function startNotificationWorker(): void {
  if (global.notificationWorkerStarted) return;
  global.notificationWorkerStarted = true;
  console.log("[notification-worker] Started (interval: 2m)");

  // Clear any stale interval from previous module load
  if (global.notificationWorkerInterval) {
    clearInterval(global.notificationWorkerInterval);
  }

  // Initial run after a short delay to let the server finish booting
  setTimeout(() => {
    processNotifications().catch(console.error);
  }, 10_000);

  global.notificationWorkerInterval = setInterval(() => {
    processNotifications().catch(console.error);
  }, WORKER_INTERVAL_MS);
}
