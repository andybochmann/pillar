import { Task } from "@/models/task";
import { NotificationPreference } from "@/models/notification-preference";
import type { IDueDateReminder } from "@/models/notification-preference";

/**
 * Compute the absolute Date for a due-date reminder given a due date,
 * a reminder config (daysBefore + time), and a timezone.
 *
 * Since due dates are date-only, the reminder fires at the configured
 * time on (dueDate − daysBefore) in the user's timezone.
 */
export function computeReminderDate(
  dueDate: Date,
  reminder: IDueDateReminder,
  timezone: string,
): Date {
  // Due dates are date-only (stored as midnight UTC). Extract the calendar
  // date from UTC components — do NOT convert to the user's timezone, because
  // that would shift the date for timezones behind UTC.
  const year = dueDate.getUTCFullYear();
  const month = dueDate.getUTCMonth();
  const day = dueDate.getUTCDate();

  // Subtract daysBefore
  const reminderDate = new Date(Date.UTC(year, month, day));
  reminderDate.setUTCDate(reminderDate.getUTCDate() - reminder.daysBefore);

  // Use Intl to find the UTC offset for this timezone at the reminder moment
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const [hours, minutes] = reminder.time.split(":").map(Number);

  // Start with a UTC guess
  const guess = new Date(
    Date.UTC(
      reminderDate.getUTCFullYear(),
      reminderDate.getUTCMonth(),
      reminderDate.getUTCDate(),
      hours,
      minutes,
      0,
    ),
  );

  // Format guess in the target timezone to see what local time it shows
  const parts = formatter.formatToParts(guess);
  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const guessLocalH = getPart("hour");
  const guessLocalM = getPart("minute");

  // Calculate offset: the difference between what we wanted and what we got
  const wantedMinutes = hours * 60 + minutes;
  const gotMinutes = guessLocalH * 60 + guessLocalM;
  let diffMinutes = wantedMinutes - gotMinutes;

  // Handle day boundary crossing using full dates (not just day numbers,
  // which break at month/year boundaries)
  const wantedDateMs = Date.UTC(
    reminderDate.getUTCFullYear(),
    reminderDate.getUTCMonth(),
    reminderDate.getUTCDate(),
  );
  const guessLocalDateMs = Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day"),
  );
  const dayDiff = Math.round(
    (guessLocalDateMs - wantedDateMs) / (24 * 60 * 60_000),
  );
  diffMinutes -= dayDiff * 24 * 60;

  // Adjust
  return new Date(guess.getTime() + diffMinutes * 60_000);
}

/**
 * Schedule the next automatic reminder for a task based on the preferences
 * of all relevant users (owner + assignee). Merges reminder configs from all
 * users, calculates reminder times using their timezone, and picks the
 * soonest future one.
 *
 * Does nothing if:
 * - The task doesn't exist or has no dueDate
 * - The task already has a reminderAt set (e.g. manually set via task sheet)
 * - No users have dueDateReminders configured
 * - All reminder times are in the past
 */
export async function scheduleNextReminder(taskId: string): Promise<void> {
  const task = await Task.findById(taskId).select(
    "reminderAt userId assigneeId dueDate",
  );
  if (!task || task.reminderAt || !task.dueDate) return;

  const userIds = [task.userId.toString()];
  if (
    task.assigneeId &&
    task.assigneeId.toString() !== task.userId.toString()
  ) {
    userIds.push(task.assigneeId.toString());
  }

  const prefs = await NotificationPreference.find({ userId: { $in: userIds } });

  // Collect all reminder dates from all users
  const now = new Date();
  const futureReminderTimes: Date[] = [];

  for (const pref of prefs) {
    const timezone = pref.timezone || "UTC";
    for (const reminder of pref.dueDateReminders) {
      const reminderDate = computeReminderDate(
        task.dueDate,
        reminder,
        timezone,
      );
      if (reminderDate.getTime() > now.getTime()) {
        futureReminderTimes.push(reminderDate);
      }
    }
  }

  if (futureReminderTimes.length === 0) return;

  futureReminderTimes.sort((a, b) => a.getTime() - b.getTime());
  await Task.updateOne({ _id: taskId }, { reminderAt: futureReminderTimes[0] });
}

/**
 * Recalculate reminderAt for all incomplete future-due tasks where the
 * given user is owner or assignee. Called when a user changes their
 * dueDateReminders preference so existing tasks get updated retroactively.
 */
export async function recalculateRemindersForUser(
  userId: string,
): Promise<void> {
  const tasks = await Task.find({
    $or: [{ userId }, { assigneeId: userId }],
    dueDate: { $gt: new Date() },
    completedAt: null,
  }).select("_id");

  if (tasks.length === 0) return;

  const taskIds = tasks.map((t) => t._id);
  // Clear all auto-scheduled reminderAt values
  await Task.updateMany(
    { _id: { $in: taskIds } },
    { $unset: { reminderAt: 1 } },
  );

  // Re-schedule each task
  for (const task of tasks) {
    await scheduleNextReminder(task._id.toString());
  }
}
