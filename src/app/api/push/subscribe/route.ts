import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PushSubscription } from "@/models/push-subscription";

const SubscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
  userAgent: z.string().optional(),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
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

  // Upsert by endpoint — transfers ownership if a different user re-subscribes
  const sub = await PushSubscription.findOneAndUpdate(
    { endpoint: result.data.endpoint },
    {
      userId: session.user.id,
      endpoint: result.data.endpoint,
      keys: result.data.keys,
      userAgent: result.data.userAgent,
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

  await PushSubscription.deleteOne({
    endpoint: result.data.endpoint,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
