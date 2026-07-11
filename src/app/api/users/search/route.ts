import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { ProjectMember } from "@/models/project-member";

// Exact-email lookup only. Substring search enabled full user-directory
// enumeration (H12), so we require a complete, valid email address and only
// ever resolve a single exact match. name/image are disclosed only when the
// target already collaborates with the caller on a shared project; otherwise
// we return just enough (id + email) to support "invite by exact email".
const EmailSchema = z.string().email();

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const emailParam = searchParams.get("email");

  const parsed = EmailSchema.safeParse(emailParam?.trim().toLowerCase());
  if (!parsed.success) {
    return NextResponse.json([]);
  }
  const email = parsed.data;

  await connectDB();

  const target = await User.findOne(
    { email },
    { _id: 1, name: 1, email: 1, image: 1 },
  ).lean();

  if (!target || target._id.toString() === session.user.id) {
    return NextResponse.json([]);
  }

  // Determine whether the target already shares a project with the caller.
  const callerProjectIds = await ProjectMember.find(
    { userId: session.user.id },
    { projectId: 1 },
  ).lean();
  const isCollaborator =
    callerProjectIds.length > 0 &&
    !!(await ProjectMember.exists({
      userId: target._id,
      projectId: { $in: callerProjectIds.map((m) => m.projectId) },
    }));

  const result = isCollaborator
    ? {
        _id: target._id.toString(),
        name: target.name,
        email: target.email,
        image: target.image,
      }
    : {
        // Non-collaborator: disclose only id + email so an invite can be sent,
        // without leaking display name / avatar of an unrelated user.
        _id: target._id.toString(),
        email: target.email,
      };

  return NextResponse.json([result]);
}
