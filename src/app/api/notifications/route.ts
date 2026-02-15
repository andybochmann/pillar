import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose, { type SortOrder } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/notification";

const CreateNotificationSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  type: z.enum(["due-soon", "overdue", "reminder", "daily-summary"]),
  title: z.string().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
  message: z.string().min(1, "Message is required").max(500, "Message must be at most 500 characters"),
  scheduledFor: z.string().datetime().optional(),
  snoozedUntil: z.string().datetime().optional(),
  metadata: z.any().optional(),
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
  };

  if (read === "true") {
    filter.read = true;
  } else if (read === "false") {
    filter.read = false;
  }

  if (dismissed === "true") {
    filter.dismissed = true;
  } else if (dismissed === "false") {
    filter.dismissed = false;
  }

  if (type) {
    filter.type = { $in: type.split(",") };
  }

  if (taskId) {
    filter.taskId = taskId;
  }

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

    const notificationData: Record<string, unknown> = {
      userId: session.user.id,
      taskId: result.data.taskId,
      type: result.data.type,
      title: result.data.title,
      message: result.data.message,
    };

    if (result.data.scheduledFor) {
      notificationData.scheduledFor = new Date(result.data.scheduledFor);
    }

    if (result.data.snoozedUntil) {
      notificationData.snoozedUntil = new Date(result.data.snoozedUntil);
    }

    if (result.data.metadata) {
      notificationData.metadata = result.data.metadata;
    }

    const notification = await Notification.create(notificationData);
    return NextResponse.json(notification, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 },
    );
  }
}
