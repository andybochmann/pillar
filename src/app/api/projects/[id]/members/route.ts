import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { ProjectMember } from "@/models/project-member";
import { User } from "@/models/user";
import { getProjectRole, getProjectMemberUserIds, requireProjectRole } from "@/lib/project-access";

const AddMemberSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(["viewer", "editor"]),
});

function serializeMember(member: {
  _id: { toString(): string };
  projectId: { toString(): string };
  userId: { toString(): string } | { _id: { toString(): string }; name: string; email: string; image?: string };
  role: string;
  invitedBy: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
  userName?: string;
  userEmail?: string;
  userImage?: string;
}) {
  const isPopulated = typeof member.userId === "object" && "_id" in member.userId;

  if (isPopulated) {
    const populatedUser = member.userId as { _id: { toString(): string }; name: string; email: string; image?: string };
    return {
      _id: member._id.toString(),
      projectId: member.projectId.toString(),
      userId: populatedUser._id.toString(),
      role: member.role,
      invitedBy: member.invitedBy.toString(),
      userName: populatedUser.name,
      userEmail: populatedUser.email,
      userImage: populatedUser.image,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }

  return {
    _id: member._id.toString(),
    projectId: member.projectId.toString(),
    userId: (member.userId as { toString(): string }).toString(),
    role: member.role,
    invitedBy: member.invitedBy.toString(),
    userName: member.userName,
    userEmail: member.userEmail,
    userImage: member.userImage,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

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

  const role = await getProjectRole(session.user.id, id);
  if (!role) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const members = await ProjectMember.find({ projectId: id })
    .populate("userId", "name email image")
    .sort({ createdAt: 1 });

  const serialized = members.map((m) => {
    const user = m.userId as unknown as {
      _id: { toString(): string };
      name: string;
      email: string;
      image?: string;
    };
    return serializeMember({
      _id: m._id,
      projectId: m.projectId,
      userId: user,
      role: m.role,
      invitedBy: m.invitedBy,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    });
  });

  return NextResponse.json(serialized);
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = AddMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();
    await requireProjectRole(session.user.id, id, "owner");

    // Find user by email
    const targetUser = await User.findOne(
      { email: result.data.email.toLowerCase() },
      { _id: 1, name: 1, email: 1, image: 1 },
    );
    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    // Check if already a member
    const existing = await ProjectMember.findOne({
      projectId: id,
      userId: targetUser._id,
    });
    if (existing) {
      return NextResponse.json(
        { error: "User is already a member" },
        { status: 409 },
      );
    }

    // Auto-create owner's ProjectMember record if not yet present
    const ownerExists = await ProjectMember.exists({
      projectId: id,
      userId: session.user.id,
    });
    if (!ownerExists) {
      await ProjectMember.create({
        projectId: id,
        userId: session.user.id,
        role: "owner",
        invitedBy: session.user.id,
      });
    }

    const member = await ProjectMember.create({
      projectId: id,
      userId: targetUser._id,
      role: result.data.role,
      invitedBy: session.user.id,
    });

    const serialized = {
      _id: member._id.toString(),
      projectId: member.projectId.toString(),
      userId: targetUser._id.toString(),
      role: member.role,
      invitedBy: member.invitedBy.toString(),
      userName: targetUser.name,
      userEmail: targetUser.email,
      userImage: targetUser.image,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };

    const targetUserIds = await getProjectMemberUserIds(id);
    emitSyncEvent({
      entity: "member",
      action: "created",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: member._id.toString(),
      projectId: id,
      targetUserIds,
      data: serialized,
      timestamp: Date.now(),
    });

    return NextResponse.json(serialized, { status: 201 });
  } catch (err) {
    const error = err as Error & { status?: number };
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status ?? 500 },
    );
  }
}
