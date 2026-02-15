import type { ITask } from "@/models/task";
import type { INotificationPreference } from "@/models/notification-preference";
import type { INotification, NotificationType } from "@/models/notification";

export interface NotificationToCreate {
  userId: string;
  taskId: string;
  type: NotificationType;
  title: string;
  message: string;
  scheduledFor?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Check if a given time falls within quiet hours
 */
export function isWithinQuietHours(
  time: Date,
  quietHoursEnabled: boolean,
  quietHoursStart: string,
  quietHoursEnd: string,
  timezone: string = "UTC",
): boolean {
  if (!quietHoursEnabled) {
    return false;
  }

  // Convert time to the specified timezone
  const timeStr = time.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const [currentHour, currentMinute] = timeStr.split(":").map(Number);
  const [startHour, startMinute] = quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = quietHoursEnd.split(":").map(Number);

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Handle quiet hours spanning midnight
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Normal case: quiet hours within same day
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Calculate when a notification should be sent based on due date and minutes before
 */
export function calculateNotificationTime(
  dueDate: Date,
  minutesBefore: number,
): Date {
  const notificationTime = new Date(dueDate);
  notificationTime.setMinutes(notificationTime.getMinutes() - minutesBefore);
  return notificationTime;
}

/**
 * Determine if a notification should be created based on timing
 * Returns true if the notification time has passed and is within the window
 */
export function shouldCreateNotification(
  notificationTime: Date,
  currentTime: Date,
  windowMinutes: number = 120, // 2-hour window by default
): boolean {
  const timeDiffMs = currentTime.getTime() - notificationTime.getTime();
  const timeDiffMinutes = timeDiffMs / (1000 * 60);

  // Notification time has passed and is within the window
  return timeDiffMinutes >= 0 && timeDiffMinutes <= windowMinutes;
}

/**
 * Format time remaining until due date
 */
function formatTimeRemaining(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

/**
 * Generate notifications for a task based on user preferences
 */
export function generateNotificationsForTask(
  task: ITask,
  preferences: INotificationPreference,
  existingNotifications: INotification[],
  currentTime: Date = new Date(),
  timezone: string = "UTC",
): NotificationToCreate[] {
  const notifications: NotificationToCreate[] = [];

  // Skip if in-app notifications are disabled
  if (!preferences.enableInAppNotifications) {
    return notifications;
  }

  // Skip if task has no due date
  if (!task.dueDate) {
    return notifications;
  }

  // Skip if task is completed
  if (task.completedAt) {
    return notifications;
  }

  const dueDate = new Date(task.dueDate);
  const taskId = task._id.toString();
  const userId = task.userId.toString();

  // Check if task is overdue
  if (dueDate < currentTime) {
    const hasOverdueNotification = existingNotifications.some(
      (n) =>
        n.taskId.toString() === taskId &&
        (n.type === "overdue" || n.type === "daily-summary"),
    );

    if (!hasOverdueNotification && preferences.enableOverdueSummary) {
      // Skip if within quiet hours
      if (
        !isWithinQuietHours(
          currentTime,
          preferences.quietHoursEnabled,
          preferences.quietHoursStart,
          preferences.quietHoursEnd,
          timezone,
        )
      ) {
        notifications.push({
          userId,
          taskId,
          type: "overdue",
          title: "Task is overdue",
          message: `"${task.title}" is overdue and needs your attention.`,
          metadata: {
            priority: task.priority,
            dueDate: dueDate.toISOString(),
            projectId: task.projectId.toString(),
          },
        });
      }
    }
    return notifications;
  }

  // Check reminder timings
  for (const minutesBefore of preferences.reminderTimings) {
    const notificationTime = calculateNotificationTime(dueDate, minutesBefore);

    // Check if notification should be sent now
    if (!shouldCreateNotification(notificationTime, currentTime)) {
      continue;
    }

    // Skip if within quiet hours
    if (
      isWithinQuietHours(
        currentTime,
        preferences.quietHoursEnabled,
        preferences.quietHoursStart,
        preferences.quietHoursEnd,
        timezone,
      )
    ) {
      continue;
    }

    // Check for duplicate notifications
    const timeRemainingStr = formatTimeRemaining(minutesBefore);
    const expectedTitle = `Task due in ${timeRemainingStr}`;
    const hasDuplicate = existingNotifications.some(
      (n) =>
        n.taskId.toString() === taskId &&
        (n.title === expectedTitle ||
          (n.type === "reminder" && n.title.startsWith("Task due in"))),
    );

    if (hasDuplicate) {
      continue;
    }

    notifications.push({
      userId,
      taskId,
      type: "reminder",
      title: expectedTitle,
      message: `"${task.title}" is due in ${timeRemainingStr}.`,
      scheduledFor: notificationTime,
      metadata: {
        priority: task.priority,
        dueDate: dueDate.toISOString(),
        projectId: task.projectId.toString(),
      },
    });
  }

  return notifications;
}
