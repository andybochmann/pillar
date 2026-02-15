import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/notification";

const UpdateNotificationSchema = z.object({
  read: z.boolean().optional(),
  dismissed: z.boolean().optional(),
  snoozedUntil: z.string().datetime().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const notification = await Notification.findOne({
    _id: id,
    userId: session.user.id,
  });

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json(notification);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = UpdateNotificationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const updateData: Record<string, unknown> = { ...result.data };

    if (result.data.snoozedUntil !== undefined) {
      updateData.snoozedUntil = result.data.snoozedUntil
        ? new Date(result.data.snoozedUntil)
        : null;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      updateData,
      { returnDocument: "after" },
    );

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json(notification);
  } catch {
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const notification = await Notification.findOneAndDelete({
    _id: id,
    userId: session.user.id,
  });

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
