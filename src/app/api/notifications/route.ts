import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { type SortOrder } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/notification";
import { emitNotificationEvent } from "@/lib/event-bus";

const CreateNotificationSchema = z.object({
  taskId: z.string().min(1, "Task ID is required").optional(),
  type: z.enum(["reminder", "overdue", "daily-summary"]),
  title: z.string().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
  message: z.string().min(1, "Message is required").max(500, "Message must be at most 500 characters"),
  scheduledFor: z.string().datetime().optional(),
  snoozedUntil: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { searchParams } = new URL(request.url);
  const read = searchParams.get("read");
  const dismissed = searchParams.get("dismissed");
  const type = searchParams.get("type");
  const taskId = searchParams.get("taskId");
  const limit = searchParams.get("limit");

  const filter: Record<string, unknown> = {
    userId: session.user.id,
    ...(read === "true" && { read: true }),
    ...(read === "false" && { read: false }),
    ...(dismissed === "true" && { dismissed: true }),
    ...(dismissed === "false" && { dismissed: false }),
    ...(type && { type: { $in: type.split(",") } }),
    ...(taskId && { taskId }),
  };

  const sort: Record<string, SortOrder> = { createdAt: -1 };

  let query = Notification.find(filter).sort(sort);

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      query = query.limit(limitNum);
    }
  }

  const notifications = await query;
  return NextResponse.json(notifications);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = CreateNotificationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const notification = await Notification.create({
      userId: session.user.id,
      type: result.data.type,
      title: result.data.title,
      message: result.data.message,
      ...(result.data.taskId && { taskId: result.data.taskId }),
      ...(result.data.scheduledFor && { scheduledFor: new Date(result.data.scheduledFor) }),
      ...(result.data.snoozedUntil && { snoozedUntil: new Date(result.data.snoozedUntil) }),
      ...(result.data.metadata && { metadata: result.data.metadata }),
    });

    emitNotificationEvent({
      type: notification.type,
      notificationId: notification._id.toString(),
      userId: session.user.id,
      ...(notification.taskId && { taskId: notification.taskId.toString() }),
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata as Record<string, unknown>,
      timestamp: Date.now(),
    });

    return NextResponse.json(notification, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 },
    );
  }
}
