import { connectDB } from "@/lib/db";
import { Account } from "@/models/account";
import { CalendarSync } from "@/models/calendar-sync";
import { Task } from "@/models/task";
import { getAccessibleProjectIds } from "@/lib/project-access";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const MAX_SYNC_ERRORS = 5;

interface CalendarEvent {
  summary: string;
  description?: string;
  start: { date: string };
  end: { date: string };
}

function taskToEvent(task: {
  title: string;
  description?: string;
  dueDate?: Date | string;
}): CalendarEvent | null {
  if (!task.dueDate) return null;

  const date =
    task.dueDate instanceof Date
      ? task.dueDate.toISOString().split("T")[0]
      : new Date(task.dueDate).toISOString().split("T")[0];

  // All-day events: end date is exclusive, so next day
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().split("T")[0];

  return {
    summary: task.title,
    description: task.description,
    start: { date },
    end: { date: endDateStr },
  };
}

export async function getValidAccessToken(
  userId: string,
): Promise<string | null> {
  await connectDB();

  const account = await Account.findOne({ userId, provider: "google" });
  if (!account?.access_token || !account.refresh_token) return null;

  // Check if token is expired (with 60s buffer)
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 60) {
    return account.access_token;
  }

  // Refresh the token
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[google-calendar] Token refresh failed:", err);
    await incrementSyncErrors(userId, `Token refresh failed: ${res.status}`);
    return null;
  }

  const data = await res.json();

  await Account.updateOne(
    { _id: account._id },
    {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      ...(data.refresh_token
        ? { refresh_token: data.refresh_token }
        : {}),
    },
  );

  return data.access_token;
}

async function incrementSyncErrors(
  userId: string,
  errorMessage: string,
): Promise<void> {
  const sync = await CalendarSync.findOneAndUpdate(
    { userId },
    {
      $inc: { syncErrors: 1 },
      lastSyncError: errorMessage,
    },
    { returnDocument: "after" },
  );

  // Auto-disable after too many consecutive errors
  if (sync && sync.syncErrors >= MAX_SYNC_ERRORS) {
    await CalendarSync.updateOne({ userId }, { enabled: false });
    console.error(
      `[google-calendar] Auto-disabled sync for user ${userId} after ${MAX_SYNC_ERRORS} errors`,
    );
  }
}

async function resetSyncErrors(userId: string): Promise<void> {
  await CalendarSync.updateOne(
    { userId },
    { syncErrors: 0, lastSyncError: undefined, lastSyncAt: new Date() },
  );
}

export async function createCalendarEvent(
  token: string,
  calendarId: string,
  event: CalendarEvent,
): Promise<string | null> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[google-calendar] Create event failed:", res.status, err);
    return null;
  }

  const data = await res.json();
  return data.id;
}

export async function updateCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: CalendarEvent,
): Promise<boolean> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (res.status === 404) {
    // Event was deleted externally — clear the reference
    return false;
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("[google-calendar] Update event failed:", res.status, err);
    return false;
  }

  return true;
}

export async function deleteCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (res.status === 404 || res.status === 410) {
    // Already deleted — that's fine
    return true;
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("[google-calendar] Delete event failed:", res.status, err);
    return false;
  }

  return true;
}

export async function syncTaskToCalendar(
  task: {
    _id: { toString(): string };
    title: string;
    description?: string;
    dueDate?: Date;
    googleCalendarEventId?: string;
  },
  userId: string,
): Promise<void> {
  await connectDB();

  const sync = await CalendarSync.findOne({ userId, enabled: true });
  if (!sync) return;

  const token = await getValidAccessToken(userId);
  if (!token) return;

  const event = taskToEvent(task);
  if (!event) return;

  const taskId = task._id.toString();

  if (task.googleCalendarEventId) {
    // Update existing event
    const updated = await updateCalendarEvent(
      token,
      sync.calendarId,
      task.googleCalendarEventId,
      event,
    );
    if (!updated) {
      // Event not found — create a new one
      const eventId = await createCalendarEvent(token, sync.calendarId, event);
      if (eventId) {
        await Task.updateOne({ _id: taskId }, { googleCalendarEventId: eventId });
        await resetSyncErrors(userId);
      } else {
        await incrementSyncErrors(userId, `Failed to create event for task ${taskId}`);
      }
    } else {
      await resetSyncErrors(userId);
    }
  } else {
    // Create new event
    const eventId = await createCalendarEvent(token, sync.calendarId, event);
    if (eventId) {
      await Task.updateOne({ _id: taskId }, { googleCalendarEventId: eventId });
      await resetSyncErrors(userId);
    } else {
      await incrementSyncErrors(userId, `Failed to create event for task ${taskId}`);
    }
  }
}

export async function removeTaskFromCalendar(
  task: {
    _id: { toString(): string };
    googleCalendarEventId?: string;
  },
  userId: string,
): Promise<void> {
  if (!task.googleCalendarEventId) return;

  await connectDB();

  const sync = await CalendarSync.findOne({ userId, enabled: true });
  if (!sync) return;

  const token = await getValidAccessToken(userId);
  if (!token) return;

  await deleteCalendarEvent(token, sync.calendarId, task.googleCalendarEventId);
  await Task.updateOne(
    { _id: task._id.toString() },
    { $unset: { googleCalendarEventId: 1 } },
  );
}

export async function bulkSyncTasksToCalendar(
  userId: string,
): Promise<{ synced: number; failed: number }> {
  await connectDB();

  const sync = await CalendarSync.findOne({ userId, enabled: true });
  if (!sync) return { synced: 0, failed: 0 };

  const token = await getValidAccessToken(userId);
  if (!token) return { synced: 0, failed: 0 };

  // Get all accessible project IDs for this user
  const projectIds = await getAccessibleProjectIds(userId);

  // Find incomplete tasks with future/today due dates
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const tasks = await Task.find({
    projectId: { $in: projectIds },
    completedAt: null,
    dueDate: { $gte: now },
  }).select("title description dueDate googleCalendarEventId");

  let synced = 0;
  let failed = 0;

  for (const task of tasks) {
    const event = taskToEvent(task);
    if (!event) continue;

    if (task.googleCalendarEventId) {
      // Already has an event — update it
      const updated = await updateCalendarEvent(
        token,
        sync.calendarId,
        task.googleCalendarEventId,
        event,
      );
      if (updated) {
        synced++;
      } else {
        // Event not found — create new
        const eventId = await createCalendarEvent(token, sync.calendarId, event);
        if (eventId) {
          await Task.updateOne(
            { _id: task._id },
            { googleCalendarEventId: eventId },
          );
          synced++;
        } else {
          failed++;
        }
      }
    } else {
      // Create new event
      const eventId = await createCalendarEvent(token, sync.calendarId, event);
      if (eventId) {
        await Task.updateOne(
          { _id: task._id },
          { googleCalendarEventId: eventId },
        );
        synced++;
      } else {
        failed++;
      }
    }
  }

  await CalendarSync.updateOne(
    { userId },
    {
      lastSyncAt: new Date(),
      ...(failed === 0
        ? { syncErrors: 0, lastSyncError: undefined }
        : { $inc: { syncErrors: 1 }, lastSyncError: `Bulk sync: ${failed} failed` }),
    },
  );

  return { synced, failed };
}
