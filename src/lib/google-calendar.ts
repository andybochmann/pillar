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

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0];
}

function taskToEvent(task: {
  title: string;
  description?: string;
  dueDate?: Date | string;
}): CalendarEvent | null {
  if (!task.dueDate) return null;

  const startDate = formatDate(task.dueDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  return {
    summary: task.title,
    description: task.description,
    start: { date: startDate },
    end: { date: formatDate(endDate) },
  };
}

function isTokenExpired(expiresAt: number | undefined): boolean {
  if (!expiresAt) return true;
  const now = Math.floor(Date.now() / 1000);
  return expiresAt <= now + 60; // 60s buffer
}

async function refreshAccessToken(
  account: { _id: { toString(): string }; refresh_token: string },
  userId: string,
): Promise<string | null> {
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
  const updateFields = {
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    ...(data.refresh_token && { refresh_token: data.refresh_token }),
  };

  await Account.updateOne({ _id: account._id }, updateFields);
  return data.access_token;
}

export async function getValidAccessToken(
  userId: string,
): Promise<string | null> {
  await connectDB();

  const account = await Account.findOne({ userId, provider: "google" });
  if (!account?.access_token || !account.refresh_token) return null;

  if (!isTokenExpired(account.expires_at)) {
    return account.access_token;
  }

  return refreshAccessToken(
    { _id: account._id, refresh_token: account.refresh_token },
    userId,
  );
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
    { $set: { syncErrors: 0, lastSyncAt: new Date() }, $unset: { lastSyncError: 1 } },
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

async function syncEventToCalendar(
  token: string,
  calendarId: string,
  eventId: string | undefined,
  event: CalendarEvent,
  taskId: string,
  userId: string,
): Promise<void> {
  if (eventId) {
    const updated = await updateCalendarEvent(token, calendarId, eventId, event);
    if (updated) {
      await resetSyncErrors(userId);
      return;
    }
  }

  // Create new event (either no eventId or update failed because event was deleted)
  const newEventId = await createCalendarEvent(token, calendarId, event);
  if (newEventId) {
    await Task.updateOne({ _id: taskId }, { googleCalendarEventId: newEventId });
    await resetSyncErrors(userId);
  } else {
    await incrementSyncErrors(userId, `Failed to create event for task ${taskId}`);
  }
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

  await syncEventToCalendar(
    token,
    sync.calendarId,
    task.googleCalendarEventId,
    event,
    task._id.toString(),
    userId,
  );
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

  const projectIds = await getAccessibleProjectIds(userId);
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

    const success = await syncSingleTask(
      token,
      sync.calendarId,
      task,
      event,
    );
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  if (failed === 0) {
    await CalendarSync.updateOne(
      { userId },
      { $set: { syncErrors: 0, lastSyncAt: new Date() }, $unset: { lastSyncError: 1 } },
    );
  } else {
    await CalendarSync.updateOne(
      { userId },
      { $set: { lastSyncAt: new Date(), lastSyncError: `Bulk sync: ${failed} failed` }, $inc: { syncErrors: 1 } },
    );
  }
  return { synced, failed };
}

async function syncSingleTask(
  token: string,
  calendarId: string,
  task: { _id: { toString(): string }; googleCalendarEventId?: string },
  event: CalendarEvent,
): Promise<boolean> {
  if (task.googleCalendarEventId) {
    const updated = await updateCalendarEvent(
      token,
      calendarId,
      task.googleCalendarEventId,
      event,
    );
    if (updated) return true;
  }

  const eventId = await createCalendarEvent(token, calendarId, event);
  if (eventId) {
    await Task.updateOne({ _id: task._id }, { googleCalendarEventId: eventId });
    return true;
  }

  return false;
}
