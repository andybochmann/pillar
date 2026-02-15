import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emitSyncEvent } from "@/lib/event-bus";
import { Project } from "@/models/project";
import { Category } from "@/models/category";
import { ProjectMember } from "@/models/project-member";
import { getAccessibleProjectIds } from "@/lib/project-access";

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  categoryId: z.string().min(1, "Category is required"),
  columns: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(50),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const includeArchived = searchParams.get("includeArchived") === "true";

  const accessibleIds = await getAccessibleProjectIds(session.user.id);
  const filter: Record<string, unknown> = { _id: { $in: accessibleIds } };
  if (categoryId) filter.categoryId = categoryId;
  if (!includeArchived) filter.archived = false;

  const projects = await Project.find(filter).sort({ createdAt: -1 }).lean();

  // Attach currentUserRole and memberCount
  const memberCounts = await ProjectMember.aggregate([
    { $match: { projectId: { $in: projects.map((p) => p._id) } } },
    { $group: { _id: "$projectId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(
    memberCounts.map((m: { _id: { toString(): string }; count: number }) => [
      m._id.toString(),
      m.count,
    ]),
  );

  const userMemberships = await ProjectMember.find(
    { userId: session.user.id, projectId: { $in: projects.map((p) => p._id) } },
    { projectId: 1, role: 1 },
  ).lean();
  const roleMap = new Map(
    userMemberships.map((m) => [m.projectId.toString(), m.role]),
  );

  const currentUserId = session.user.id;
  const enriched = projects.map((p) => ({
    ...p,
    _id: p._id.toString(),
    categoryId: p.categoryId.toString(),
    userId: p.userId.toString(),
    currentUserRole: roleMap.get(p._id.toString()) ?? (p.userId.toString() === currentUserId ? "owner" : "editor"),
    memberCount: countMap.get(p._id.toString()) ?? 1,
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = CreateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    await connectDB();

    const category = await Category.findOne({
      _id: result.data.categoryId,
      userId: session.user.id,
    });
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    const project = await Project.create({
      ...result.data,
      userId: session.user.id,
    });

    // Create owner membership record
    await ProjectMember.create({
      projectId: project._id,
      userId: session.user.id,
      role: "owner",
      invitedBy: session.user.id,
    });

    emitSyncEvent({
      entity: "project",
      action: "created",
      userId: session.user.id,
      sessionId: request.headers.get("X-Session-Id") ?? "",
      entityId: project._id.toString(),
      data: project.toJSON(),
      timestamp: Date.now(),
    });

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
