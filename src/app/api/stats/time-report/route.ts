import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { getAccessibleProjectIds } from "@/lib/project-access";
import { buildTimeReport, type ReportSession } from "@/lib/time-report";
import type { TimeReport } from "@/types";

const querySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(8),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = querySchema.safeParse({
    weeks: request.nextUrl.searchParams.get("weeks") ?? undefined,
  });
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }
  const { weeks } = result.data;

  try {
    await connectDB();

    const userId = session.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Scope to every project the user can access. Archived projects are kept
    // so historical tracked time is not lost from the report.
    const accessibleIds = await getAccessibleProjectIds(userId);
    const projects = await Project.find(
      { _id: { $in: accessibleIds } },
      { _id: 1, name: 1 },
    ).lean();

    const projectIds = projects.map((p) => p._id);
    const projectNames = new Map(
      projects.map((p) => [p._id.toString(), p.name]),
    );

    // Unwind time sessions and keep only the CURRENT user's completed sessions.
    // A shared task may carry sessions from several members; the per-session
    // userId filter guarantees we only ever count the caller's own time.
    const rows = await Task.aggregate<{
      projectId: mongoose.Types.ObjectId;
      startedAt: Date;
      endedAt: Date;
    }>([
      { $match: { projectId: { $in: projectIds } } },
      { $unwind: "$timeSessions" },
      {
        $match: {
          "timeSessions.userId": userObjectId,
          "timeSessions.endedAt": { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          _id: 0,
          projectId: 1,
          startedAt: "$timeSessions.startedAt",
          endedAt: "$timeSessions.endedAt",
        },
      },
    ]);

    const sessions: ReportSession[] = rows.map((row) => ({
      projectId: row.projectId.toString(),
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    }));

    const report = buildTimeReport(sessions, { weeks });

    const response: TimeReport = {
      totalMs: report.totalMs,
      byProject: report.byProject.map((p) => ({
        projectId: p.projectId,
        projectName: projectNames.get(p.projectId) ?? "Unknown project",
        totalMs: p.totalMs,
      })),
      byWeek: report.byWeek,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to build time report" },
      { status: 500 },
    );
  }
}
