import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { NotificationPreference } from "@/models/notification-preference";

const UpdatePreferencesSchema = z.object({
  enableBrowserPush: z.boolean().optional(),
  enableInAppNotifications: z.boolean().optional(),
  reminderTimings: z
    .array(z.number().positive())
    .min(0)
    .max(10)
    .optional(),
  enableEmailDigest: z.boolean().optional(),
  emailDigestFrequency: z.enum(["daily", "weekly", "none"]).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, "Must be in HH:mm format")
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, "Must be in HH:mm format")
    .optional(),
  enableOverdueSummary: z.boolean().optional(),
});

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

  return NextResponse.json({
    id: preferences._id.toString(),
    userId: preferences.userId.toString(),
    enableBrowserPush: preferences.enableBrowserPush,
    enableInAppNotifications: preferences.enableInAppNotifications,
    reminderTimings: preferences.reminderTimings,
    enableEmailDigest: preferences.enableEmailDigest,
    emailDigestFrequency: preferences.emailDigestFrequency,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietHoursStart: preferences.quietHoursStart,
    quietHoursEnd: preferences.quietHoursEnd,
    enableOverdueSummary: preferences.enableOverdueSummary,
    pushSubscription: preferences.pushSubscription,
    createdAt: preferences.createdAt.toISOString(),
    updatedAt: preferences.updatedAt.toISOString(),
  });
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

  await connectDB();

  const preferences = await NotificationPreference.findOneAndUpdate(
    { userId: session.user.id },
    { $set: result.data },
    { returnDocument: "after", upsert: true },
  );

  if (!preferences) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: preferences._id.toString(),
    userId: preferences.userId.toString(),
    enableBrowserPush: preferences.enableBrowserPush,
    enableInAppNotifications: preferences.enableInAppNotifications,
    reminderTimings: preferences.reminderTimings,
    enableEmailDigest: preferences.enableEmailDigest,
    emailDigestFrequency: preferences.emailDigestFrequency,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietHoursStart: preferences.quietHoursStart,
    quietHoursEnd: preferences.quietHoursEnd,
    enableOverdueSummary: preferences.enableOverdueSummary,
    pushSubscription: preferences.pushSubscription,
    createdAt: preferences.createdAt.toISOString(),
    updatedAt: preferences.updatedAt.toISOString(),
  });
}
