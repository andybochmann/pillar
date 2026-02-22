import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Notification } from "@/models/notification";
import { requireProjectRole } from "@/lib/project-access";

const SnoozeSchema = z.object({
  notificationId: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = SnoozeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Require editor+ role on the task's project
    try {
      await requireProjectRole(
        session.user.id,
        task.projectId.toString(),
        "editor",
      );
    } catch (err) {
      const status = (err as Error & { status?: number }).status || 500;
      if (status === 404) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Snooze: set reminderAt to now + 24 hours
    const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Task.updateOne({ _id: id }, { reminderAt: snoozedUntil });

    // If notificationId provided, mark it as read and set snoozedUntil
    if (result.data.notificationId) {
      await Notification.updateOne(
        { _id: result.data.notificationId, userId: session.user.id },
        { read: true, snoozedUntil },
      );
    }

    return NextResponse.json({ success: true, snoozedUntil: snoozedUntil.toISOString() });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
