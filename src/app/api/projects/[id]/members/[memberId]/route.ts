import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { ProjectMember } from "@/models/project-member";
import { Task } from "@/models/task";
import { getProjectMemberUserIds, requireProjectRole } from "@/lib/project-access";

const UpdateRoleSchema = z.object({
  role: z.enum(["owner", "editor"]),
});

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, memberId } = await params;
    const body = await request.json();
    const result = UpdateRoleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();
    await requireProjectRole(session.user.id, id, "owner");

    const member = await ProjectMember.findOne({
      _id: memberId,
      projectId: id,
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.userId.toString() === session.user.id) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 },
      );
    }

    member.role = result.data.role;
    await member.save();

    const serialized = {
      _id: member._id.toString(),
      projectId: member.projectId.toString(),
      userId: member.userId.toString(),
      role: member.role,
      invitedBy: member.invitedBy.toString(),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };

    const targetUserIds = await getProjectMemberUserIds(id);
    emitSyncEvent({
      entity: "member",
      action: "updated",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: memberId,
      projectId: id,
      targetUserIds,
      data: serialized,
      timestamp: Date.now(),
    });

    return NextResponse.json(serialized);
  } catch (err) {
    const error = err as Error & { status?: number };
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status ?? 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, memberId } = await params;
    await connectDB();

    const member = await ProjectMember.findOne({
      _id: memberId,
      projectId: id,
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isSelf = member.userId.toString() === session.user.id;
    if (!isSelf) {
      await requireProjectRole(session.user.id, id, "owner");
    }

    // Prevent removing the last owner
    if (member.role === "owner") {
      const ownerCount = await ProjectMember.countDocuments({
        projectId: id,
        role: "owner",
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner" },
          { status: 400 },
        );
      }
    }

    // Get target user IDs before deleting
    const targetUserIds = await getProjectMemberUserIds(id);

    await ProjectMember.deleteOne({ _id: memberId });

    // Clear assigneeId on removed user's tasks in this project
    await Task.updateMany(
      { projectId: id, assigneeId: member.userId },
      { $unset: { assigneeId: 1 } },
    );

    emitSyncEvent({
      entity: "member",
      action: "deleted",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: memberId,
      projectId: id,
      targetUserIds,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err as Error & { status?: number };
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status ?? 500 },
    );
  }
}
