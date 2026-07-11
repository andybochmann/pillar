import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
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
    const userId = session.user.id;

    // Collect the user's owned project IDs so we can cascade-delete
    // collaborators' tasks, notes, and membership records for those projects.
    const userProjects = await Project.find(
      { userId },
      { _id: 1 },
    ).lean();
    const projectIds = userProjects.map((p) => p._id);

    // Projects owned by OTHERS where this user is a member. Removing the user
    // must sync to those members and must NOT corrupt their boards, so we
    // preserve tasks the user authored there and only clear dangling assignee
    // references (L24).
    const otherMemberships = await ProjectMember.find(
      { userId, projectId: { $nin: projectIds } },
      { _id: 1, projectId: 1 },
    ).lean();
    const otherProjectIds = otherMemberships.map((m) => m.projectId);
    const membershipIdByProject = new Map(
      otherMemberships.map((m) => [m.projectId.toString(), m._id.toString()]),
    );

    // Capture the audience for each shared project BEFORE deleting memberships.
    const sharedMembers = await ProjectMember.find(
      { projectId: { $in: otherProjectIds } },
      { projectId: 1, userId: 1 },
    ).lean();
    const audienceByProject = new Map<string, string[]>();
    for (const m of sharedMembers) {
      const pid = m.projectId.toString();
      const list = audienceByProject.get(pid) ?? [];
      list.push(m.userId.toString());
      audienceByProject.set(pid, list);
    }

    // Collect task IDs before deletion to clean up all notifications (including collaborators')
    const projectTaskIds = await Task.find(
      { projectId: { $in: projectIds } },
      { _id: 1 },
    ).lean();
    const taskIds = projectTaskIds.map((t) => t._id);

    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await Promise.all([
      // Delete tasks belonging to the user's OWN projects. Tasks the user
      // authored inside OTHER owners' shared projects are preserved so those
      // boards aren't corrupted.
      Task.deleteMany({ projectId: { $in: projectIds } }),
      // Clear dangling assignee references left on shared-project tasks (L24).
      Task.updateMany(
        { projectId: { $in: otherProjectIds }, assigneeId: userId },
        { $unset: { assigneeId: 1 } },
      ),
      Project.deleteMany({ userId }),
      Category.deleteMany({ userId }),
      Label.deleteMany({ userId }),
      // Delete notes in the user's own projects plus the user's own category
      // notes; preserve notes authored inside others' shared projects.
      Note.deleteMany({
        $or: [
          { projectId: { $in: projectIds } },
          { userId, parentType: "category" },
        ],
      }),
      // Delete membership records for user OR for user's projects (other members)
      ProjectMember.deleteMany({
        $or: [
          { userId },
          { projectId: { $in: projectIds } },
        ],
      }),
      AccessToken.deleteMany({ userId }),
      PushSubscription.deleteMany({ userId }),
      Notification.deleteMany({
        $or: [
          { userId },
          { taskId: { $in: taskIds } },
        ],
      }),
      NotificationPreference.deleteMany({ userId }),
      Account.deleteMany({ userId }),
      FilterPreset.deleteMany({ userId }),
    ]);

    // Notify members of shared (other-owned) projects that this user was removed
    // so their boards drop the member and refresh cleared assignee refs (L24).
    const timestamp = Date.now();
    for (const [projectId, memberIds] of audienceByProject) {
      const targetUserIds = memberIds.filter((uid) => uid !== userId);
      if (targetUserIds.length === 0) continue;
      emitSyncEvent({
        entity: "member",
        action: "deleted",
        userId,
        sessionId: "",
        entityId: membershipIdByProject.get(projectId) ?? userId,
        projectId,
        targetUserIds,
        timestamp,
      });
    }

    return NextResponse.json({ message: "Account deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
