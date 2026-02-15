import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { NotificationPreference } from "@/models/notification-preference";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = SubscribeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  await connectDB();

  const preference = await NotificationPreference.findOneAndUpdate(
    { userId: session.user.id },
    {
      $set: {
        pushSubscription: result.data,
        enableBrowserPush: true,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!preference) {
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: preference._id.toString(),
    userId: preference.userId.toString(),
    enableBrowserPush: preference.enableBrowserPush,
    enableInAppNotifications: preference.enableInAppNotifications,
    reminderTimings: preference.reminderTimings,
    enableEmailDigest: preference.enableEmailDigest,
    emailDigestFrequency: preference.emailDigestFrequency,
    quietHoursEnabled: preference.quietHoursEnabled,
    quietHoursStart: preference.quietHoursStart,
    quietHoursEnd: preference.quietHoursEnd,
    enableOverdueSummary: preference.enableOverdueSummary,
    pushSubscription: preference.pushSubscription,
    createdAt: preference.createdAt.toISOString(),
    updatedAt: preference.updatedAt.toISOString(),
  });
}
