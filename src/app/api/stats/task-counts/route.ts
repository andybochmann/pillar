import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import type { TaskCounts } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const userId = session.user.id;

    // Get non-archived projects for this user
    const projects = await Project.find(
      { userId, archived: false },
      { _id: 1, categoryId: 1 },
    ).lean();

    const projectIds = projects.map((p) => p._id);
    const projectCategoryMap = new Map(
      projects.map((p) => [p._id.toString(), p.categoryId.toString()]),
    );

    // Aggregate task counts by project and column
    // projectIds already scoped to user's non-archived projects
    const pipeline = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: { projectId: "$projectId", columnId: "$columnId" },
          count: { $sum: 1 },
        },
      },
    ]);

    const byCategory: Record<string, number> = {};
    const byProjectAndColumn: Record<string, Record<string, number>> = {};

    for (const row of pipeline) {
      const projId = row._id.projectId.toString();
      const columnId = row._id.columnId;
      const count = row.count;

      // Build byProjectAndColumn
      if (!byProjectAndColumn[projId]) {
        byProjectAndColumn[projId] = {};
      }
      byProjectAndColumn[projId][columnId] = count;

      // Build byCategory
      const catId = projectCategoryMap.get(projId);
      if (catId) {
        byCategory[catId] = (byCategory[catId] || 0) + count;
      }
    }

    const result: TaskCounts = { byCategory, byProjectAndColumn };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch task counts" },
      { status: 500 },
    );
  }
}
