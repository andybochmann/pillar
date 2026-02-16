import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processNotifications } from "@/lib/notification-worker";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processNotifications(session.user.id);
    return NextResponse.json({
      notificationsCreated: result.reminders + result.overdue + result.dailySummaries,
      reminders: result.reminders,
      overdue: result.overdue,
      dailySummaries: result.dailySummaries,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
