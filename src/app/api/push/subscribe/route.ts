import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PushSubscription } from "@/models/push-subscription";

const WebSubscribeSchema = z.object({
  platform: z.literal("web").optional().default("web"),
  endpoint: z.string().url("Invalid endpoint URL"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
  userAgent: z.string().optional(),
});

const NativeSubscribeSchema = z.object({
  platform: z.enum(["android", "ios"]),
  deviceToken: z.string().min(1, "Device token is required"),
  userAgent: z.string().optional(),
});

const SubscribeSchema = z.union([WebSubscribeSchema, NativeSubscribeSchema]);

const UnsubscribeSchema = z.union([
  z.object({ endpoint: z.string().url("Invalid endpoint URL") }),
  z.object({ deviceToken: z.string().min(1, "Device token is required") }),
]);

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

  const data = result.data;

  if ("endpoint" in data) {
    // Web subscription — upsert by endpoint
    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint: data.endpoint },
      {
        userId: session.user.id,
        platform: "web",
        endpoint: data.endpoint,
        keys: data.keys,
        userAgent: data.userAgent,
      },
      { upsert: true, returnDocument: "after" },
    );

    if (!sub) {
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        _id: sub._id.toString(),
        endpoint: sub.endpoint,
        createdAt: sub.createdAt.toISOString(),
      },
      { status: 201 },
    );
  }

  // Native subscription — upsert by deviceToken
  const sub = await PushSubscription.findOneAndUpdate(
    { deviceToken: data.deviceToken },
    {
      userId: session.user.id,
      platform: data.platform,
      deviceToken: data.deviceToken,
      userAgent: data.userAgent,
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!sub) {
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      _id: sub._id.toString(),
      deviceToken: sub.deviceToken,
      createdAt: sub.createdAt.toISOString(),
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = UnsubscribeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  await connectDB();

  const data = result.data;

  if ("endpoint" in data) {
    await PushSubscription.deleteOne({
      endpoint: data.endpoint,
      userId: session.user.id,
    });
  } else {
    await PushSubscription.deleteOne({
      deviceToken: data.deviceToken,
      userId: session.user.id,
    });
  }

  return NextResponse.json({ success: true });
}
