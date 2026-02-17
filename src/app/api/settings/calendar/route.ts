import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Account } from "@/models/account";
import { CalendarSync } from "@/models/calendar-sync";
import { Task } from "@/models/task";
import { bulkSyncTasksToCalendar } from "@/lib/google-calendar";
import type { CalendarSyncStatus } from "@/types";

const UpdateCalendarSyncSchema = z.object({
  enabled: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const account = await Account.findOne({
    userId: session.user.id,
    provider: "google",
  }).select("access_token refresh_token scope");

  const hasCalendarTokens = !!(
    account?.access_token &&
    account?.refresh_token &&
    account?.scope?.includes("calendar")
  );

  const sync = await CalendarSync.findOne({ userId: session.user.id });

  const status: CalendarSyncStatus = {
    connected: hasCalendarTokens,
    enabled: sync?.enabled ?? false,
    calendarId: sync?.calendarId ?? "primary",
    syncErrors: sync?.syncErrors ?? 0,
    lastSyncError: sync?.lastSyncError,
    lastSyncAt: sync?.lastSyncAt?.toISOString(),
  };

  return NextResponse.json(status);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = UpdateCalendarSyncSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    // Verify user has calendar tokens
    const account = await Account.findOne({
      userId: session.user.id,
      provider: "google",
    }).select("refresh_token scope");

    if (!account?.refresh_token || !account?.scope?.includes("calendar")) {
      return NextResponse.json(
        { error: "Google Calendar is not connected. Please connect first." },
        { status: 400 },
      );
    }

    const sync = await CalendarSync.findOneAndUpdate(
      { userId: session.user.id },
      {
        enabled: result.data.enabled,
        ...(result.data.enabled ? { syncErrors: 0, lastSyncError: undefined } : {}),
      },
      { upsert: true, returnDocument: "after" },
    );

    // Trigger bulk sync when enabling
    if (result.data.enabled) {
      bulkSyncTasksToCalendar(session.user.id).catch((err) => {
        console.error("[calendar/PATCH] Bulk sync failed:", err);
      });
    }

    const status: CalendarSyncStatus = {
      connected: true,
      enabled: sync!.enabled,
      calendarId: sync!.calendarId,
      syncErrors: sync!.syncErrors,
      lastSyncError: sync!.lastSyncError,
      lastSyncAt: sync!.lastSyncAt?.toISOString(),
    };

    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Remove calendar tokens from account (keep the account for login)
  await Account.updateOne(
    { userId: session.user.id, provider: "google" },
    {
      $unset: {
        access_token: 1,
        refresh_token: 1,
        expires_at: 1,
        scope: 1,
        token_type: 1,
      },
    },
  );

  // Delete sync preferences
  await CalendarSync.deleteOne({ userId: session.user.id });

  // Clear googleCalendarEventId from all user's tasks
  await Task.updateMany(
    { userId: session.user.id, googleCalendarEventId: { $exists: true } },
    { $unset: { googleCalendarEventId: 1 } },
  );

  return NextResponse.json({ success: true });
}
