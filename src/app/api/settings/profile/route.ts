import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { Category } from "@/models/category";
import { Label } from "@/models/label";
import { Note } from "@/models/note";
import { ProjectMember } from "@/models/project-member";
import { AccessToken } from "@/models/access-token";
import { PushSubscription } from "@/models/push-subscription";
import { Notification } from "@/models/notification";
import { NotificationPreference } from "@/models/notification-preference";
import { Account } from "@/models/account";
import { FilterPreset } from "@/models/filter-preset";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const user = await User.findById(session.user.id).select(
    "name email image passwordHash createdAt",
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const accounts = await Account.find({ userId: user._id }).select("provider").lean();
  const providers = accounts.map((a) => a.provider);

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
    hasPassword: !!user.passwordHash,
    providers,
    createdAt: user.createdAt.toISOString(),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = UpdateProfileSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  await connectDB();

  const user = await User.findByIdAndUpdate(
    session.user.id,
    { $set: result.data },
    { returnDocument: "after" },
  ).select("name email image createdAt");

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
    createdAt: user.createdAt.toISOString(),
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  try {
    const deleted = await User.findByIdAndDelete(session.user.id);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await Promise.all([
      Task.deleteMany({ userId: session.user.id }),
      Project.deleteMany({ userId: session.user.id }),
      Category.deleteMany({ userId: session.user.id }),
      Label.deleteMany({ userId: session.user.id }),
      Note.deleteMany({ userId: session.user.id }),
      ProjectMember.deleteMany({ userId: session.user.id }),
      AccessToken.deleteMany({ userId: session.user.id }),
      PushSubscription.deleteMany({ userId: session.user.id }),
      Notification.deleteMany({ userId: session.user.id }),
      NotificationPreference.deleteMany({ userId: session.user.id }),
      Account.deleteMany({ userId: session.user.id }),
      FilterPreset.deleteMany({ userId: session.user.id }),
    ]);

    return NextResponse.json({ message: "Account deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
