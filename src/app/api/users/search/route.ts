import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { ProjectMember } from "@/models/project-member";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email || email.length < 2) {
    return NextResponse.json([]);
  }

  await connectDB();

  // Find all projects the current user is a member of
  const userProjects = await ProjectMember.find(
    { userId: session.user.id },
    { projectId: 1 },
  ).lean();

  if (userProjects.length === 0) {
    return NextResponse.json([]);
  }

  const projectIds = userProjects.map((p) => p.projectId);

  // Find all users who are members of those projects
  const allowedUserIds = await ProjectMember.find(
    { projectId: { $in: projectIds } },
    { userId: 1 },
  ).distinct("userId");

  // Search for users matching email within allowed users
  const users = await User.find(
    {
      _id: {
        $in: allowedUserIds,
        $ne: session.user.id,
      },
      email: { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
    },
    { _id: 1, name: 1, email: 1, image: 1 },
  )
    .limit(10)
    .lean();

  const serialized = users.map((u) => ({
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    image: u.image,
  }));

  return NextResponse.json(serialized);
}
