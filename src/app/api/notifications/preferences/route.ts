import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { NotificationPreference } from "@/models/notification-preference";
import { recalculateRemindersForUser } from "@/lib/reminder-scheduler";

const UpdatePreferencesSchema = z.object({
  enableInAppNotifications: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, "Must be in HH:mm format")
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, "Must be in HH:mm format")
    .optional(),
  enableBrowserPush: z.boolean().optional(),
  enableOverdueSummary: z.boolean().optional(),
  enableDailySummary: z.boolean().optional(),
  dailySummaryTime: z
    .string()
    .regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, "Must be in HH:mm format")
    .optional(),
  dueDateReminders: z
    .array(
      z.object({
        daysBefore: z.number().int().min(0).max(30),
        time: z
          .string()
          .regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, "Must be in HH:mm format"),
      }),
    )
    .max(10)
    .optional(),
  timezone: z.string().min(1).max(100).optional(),
});

function serializePreferences(
  preferences: InstanceType<typeof NotificationPreference>,
) {
  return {
    id: preferences._id.toString(),
    userId: preferences.userId.toString(),
    enableInAppNotifications: preferences.enableInAppNotifications,
    enableBrowserPush: preferences.enableBrowserPush,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietHoursStart: preferences.quietHoursStart,
    quietHoursEnd: preferences.quietHoursEnd,
    enableOverdueSummary: preferences.enableOverdueSummary,
    enableDailySummary: preferences.enableDailySummary,
    dailySummaryTime: preferences.dailySummaryTime,
    dueDateReminders: preferences.dueDateReminders,
    timezone: preferences.timezone,
    createdAt: preferences.createdAt.toISOString(),
    updatedAt: preferences.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  let preferences = await NotificationPreference.findOne({
    userId: session.user.id,
  });

  if (!preferences) {
    preferences = await NotificationPreference.create({
      userId: session.user.id,
    });
  }

  return NextResponse.json(serializePreferences(preferences));
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = UpdatePreferencesSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  const userId = session.user.id;

  await connectDB();

  const preferences = await NotificationPreference.findOneAndUpdate(
    { userId },
    { $set: result.data },
    { returnDocument: "after", upsert: true },
  );

  if (!preferences) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }

  // Recalculate reminders for existing tasks when timings or timezone change
  if (result.data.dueDateReminders || result.data.timezone) {
    recalculateRemindersForUser(userId).catch((err) => {
      console.error(
        `[preferences/PATCH] Failed to recalculate reminders for user ${userId}:`,
        err,
      );
    });
  }

  return NextResponse.json(serializePreferences(preferences));
}
