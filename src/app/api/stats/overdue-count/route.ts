import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { getAccessibleProjectIds } from "@/lib/project-access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const userId = session.user.id;

    // Get non-archived accessible projects
    const accessibleIds = await getAccessibleProjectIds(userId);
    const projects = await Project.find(
      { _id: { $in: accessibleIds }, archived: false },
      { _id: 1 },
    ).lean();

    const projectIds = projects.map((p) => p._id);

    // Count tasks that are overdue: past due date and not completed
    // Use UTC midnight since due dates are stored as midnight UTC
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const count = await Task.countDocuments({
      projectId: { $in: projectIds },
      completedAt: null,
      dueDate: { $lt: now },
    });

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch overdue count" },
      { status: 500 },
    );
  }
}
