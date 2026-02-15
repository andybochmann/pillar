import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Notification } from "@/models/notification";
import { NotificationPreference } from "@/models/notification-preference";
import { generateNotificationsForTask } from "@/lib/notification-scheduler";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  try {
    // Get or create user notification preferences
    let preferences = await NotificationPreference.findOne({
      userId: session.user.id,
    });

    if (!preferences) {
      preferences = await NotificationPreference.create({
        userId: session.user.id,
      });
    }

    // Find all tasks with due dates that are not completed
    const tasks = await Task.find({
      userId: session.user.id,
      dueDate: { $exists: true, $ne: null },
      completedAt: null,
    });

    // Get existing notifications to avoid duplicates
    const existingNotifications = await Notification.find({
      userId: session.user.id,
    });

    // Generate notifications for each task
    let notificationsCreated = 0;
    const currentTime = new Date();

    for (const task of tasks) {
      const notificationsToCreate = generateNotificationsForTask(
        task,
        preferences,
        existingNotifications,
        currentTime,
      );

      if (notificationsToCreate.length > 0) {
        await Notification.insertMany(notificationsToCreate);
        notificationsCreated += notificationsToCreate.length;
      }
    }

    return NextResponse.json({ notificationsCreated });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
