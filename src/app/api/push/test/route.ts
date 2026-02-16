import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isWebPushConfigured, sendPushToUser } from "@/lib/web-push";
import { PushSubscription } from "@/models/push-subscription";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Push notifications are not configured on this server (VAPID keys missing)" },
      { status: 503 },
    );
  }

  await connectDB();

  const subscriptions = await PushSubscription.find({ userId: session.user.id });
  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "No push subscriptions found. Enable browser push notifications first." },
      { status: 404 },
    );
  }

  const sent = await sendPushToUser(session.user.id, {
    title: "Test Push Notification",
    message: "Your push notification pipeline is working end-to-end!",
    tag: `pillar-test-${Date.now()}`,
    url: "/",
  });

  return NextResponse.json({
    sent,
    total: subscriptions.length,
    message: sent > 0
      ? `Push notification sent to ${sent} of ${subscriptions.length} device(s)`
      : "Push notification failed to send to any device",
  });
}
