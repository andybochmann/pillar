import { Task } from "@/models/task";
import { NotificationPreference } from "@/models/notification-preference";

/**
 * Schedule the next automatic reminder for a task based on the preferences
 * of all relevant users (owner + assignee). Merges timing sets from all
 * users, calculates reminder times, and picks the soonest future one.
 *
 * Loads the task from DB to get userId, assigneeId, and dueDate internally.
 *
 * Does nothing if:
 * - The task doesn't exist or has no dueDate
 * - The task already has a reminderAt set (e.g. manually set via task sheet)
 * - No users have reminderTimings configured
 * - All reminder times are in the past
 */
export async function scheduleNextReminder(taskId: string): Promise<void> {
  const task = await Task.findById(taskId).select("reminderAt userId assigneeId dueDate");
  if (!task || task.reminderAt || !task.dueDate) return;

  const userIds = [task.userId.toString()];
  if (task.assigneeId && task.assigneeId.toString() !== task.userId.toString()) {
    userIds.push(task.assigneeId.toString());
  }

  const prefs = await NotificationPreference.find({ userId: { $in: userIds } });

  // Merge all timings from all users into a single set
  const allTimings = new Set<number>();
  for (const pref of prefs) {
    for (const timing of pref.reminderTimings) {
      allTimings.add(timing);
    }
  }
  if (allTimings.size === 0) return;

  // Calculate reminder times, filter to future, pick soonest
  const now = new Date();
  const dueDateMs = task.dueDate.getTime();
  const futureReminderTimes = [...allTimings]
    .map((minutes) => new Date(dueDateMs - minutes * 60_000))
    .filter((time) => time.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  if (futureReminderTimes.length === 0) return;
  await Task.updateOne({ _id: taskId }, { reminderAt: futureReminderTimes[0] });
}

/**
 * Recalculate reminderAt for all incomplete future-due tasks where the
 * given user is owner or assignee. Called when a user changes their
 * reminderTimings preference so existing tasks get updated retroactively.
 */
export async function recalculateRemindersForUser(userId: string): Promise<void> {
  const tasks = await Task.find({
    $or: [{ userId }, { assigneeId: userId }],
    dueDate: { $gt: new Date() },
    completedAt: null,
  }).select("_id");

  if (tasks.length === 0) return;

  const taskIds = tasks.map((t) => t._id);
  // Clear all auto-scheduled reminderAt values
  await Task.updateMany({ _id: { $in: taskIds } }, { $unset: { reminderAt: 1 } });

  // Re-schedule each task
  for (const task of tasks) {
    await scheduleNextReminder(task._id.toString());
  }
}
