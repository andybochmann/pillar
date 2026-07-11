import type { Types } from "mongoose";
import { Task } from "@/models/task";
import { NotificationPreference } from "@/models/notification-preference";
import type { IDueDateReminder } from "@/models/notification-preference";

/** Grace window (ms) — reminders computed up to this far in the past still fire. */
const GRACE_MS = 30 * 60_000; // 30 minutes

/**
 * Projection shape used by recalculateRemindersForUser. `reminderSource`
 * distinguishes auto-scheduled reminders (safe to recompute) from manual ones
 * (must be preserved); it is optional to tolerate legacy rows written before the
 * field existed.
 */
interface ReminderTaskRow {
  _id: Types.ObjectId;
  reminderAt?: Date | null;
  reminderSource?: "auto" | "manual";
}

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
  const wantedMinutes = hours * 60 + minutes;
  const wantedDateMs = Date.UTC(
    reminderDate.getUTCFullYear(),
    reminderDate.getUTCMonth(),
    reminderDate.getUTCDate(),
  );

  // Given a candidate UTC instant, measure how far its local (timezone) wall
  // clock is from the wanted local date/time and return a corrected instant.
  const correctToLocal = (candidate: Date): Date => {
    const parts = formatter.formatToParts(candidate);
    const getPart = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    const gotMinutes = getPart("hour") * 60 + getPart("minute");
    let diffMinutes = wantedMinutes - gotMinutes;

    // Handle day boundary crossing using full dates (not just day numbers,
    // which break at month/year boundaries)
    const gotDateMs = Date.UTC(
      getPart("year"),
      getPart("month") - 1,
      getPart("day"),
    );
    const dayDiff = Math.round((gotDateMs - wantedDateMs) / (24 * 60 * 60_000));
    diffMinutes -= dayDiff * 24 * 60;

    return new Date(candidate.getTime() + diffMinutes * 60_000);
  };

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

  // First pass corrects for the timezone's base offset. On DST-transition days
  // the offset at the guess instant differs from the offset at the corrected
  // instant, leaving the result up to an hour off — a second pass re-measures
  // at the corrected instant and fixes that residual.
  const firstPass = correctToLocal(guess);
  return correctToLocal(firstPass);
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
  const cutoff = now.getTime() - GRACE_MS;
  const futureReminderTimes: Date[] = [];

  for (const pref of prefs) {
    const timezone = pref.timezone || "UTC";
    for (const reminder of pref.dueDateReminders) {
      const reminderDate = computeReminderDate(
        task.dueDate,
        reminder,
        timezone,
      );
      if (reminderDate.getTime() > cutoff) {
        futureReminderTimes.push(reminderDate);
      }
    }
  }

  if (futureReminderTimes.length === 0) return;

  futureReminderTimes.sort((a, b) => a.getTime() - b.getTime());
  // Stamp reminderSource so recalculateRemindersForUser can tell this auto-set
  // reminder apart from a user's manually-set one.
  await Task.updateOne(
    { _id: taskId },
    { $set: { reminderAt: futureReminderTimes[0], reminderSource: "auto" } },
  );
}

/**
 * Recalculate reminderAt for all incomplete future-due tasks where the
 * given user is owner or assignee. Called when a user changes their
 * dueDateReminders preference so existing tasks get updated retroactively.
 *
 * Uses a 24-hour buffer on the date filter so tasks whose dueDate (stored
 * as midnight UTC) has technically passed in UTC but is still "today" or
 * "tomorrow" in negative-UTC timezones are included.
 */
export async function recalculateRemindersForUser(
  userId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  const tasks = await Task.find({
    $or: [{ userId }, { assigneeId: userId }],
    dueDate: { $gte: cutoff },
    completedAt: null,
  })
    .select("_id reminderAt reminderSource")
    .lean<ReminderTaskRow[]>();

  if (tasks.length === 0) return;

  // Re-schedule tasks that either have no reminder yet, or whose reminder was
  // auto-scheduled (reminderSource === "auto"). Manually-set reminders
  // (reminderSource === "manual") are preserved.
  //
  // Forward/back-compatible: before the model has `reminderSource`, this field
  // is always undefined, so the predicate reduces to `!t.reminderAt` — the
  // previous behavior — and no manual reminder is clobbered. Once the model +
  // routes set reminderSource, auto-scheduled reminders (which also set
  // reminderAt) become eligible for recalculation, fixing the bug where a
  // preference change updated nothing.
  const autoTasks = tasks.filter(
    (t) => !t.reminderAt || t.reminderSource === "auto",
  );
  if (autoTasks.length === 0) return;

  const autoTaskIds = autoTasks.map((t) => t._id);
  await Task.updateMany(
    { _id: { $in: autoTaskIds } },
    { $unset: { reminderAt: 1 } },
  );

  // Re-schedule only the auto-scheduled tasks
  for (const task of autoTasks) {
    await scheduleNextReminder(task._id.toString());
  }
}
