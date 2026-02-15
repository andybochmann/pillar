import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { ProjectMember } from "@/models/project-member";
import { redirect, notFound } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";
import { getProjectRole } from "@/lib/project-access";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  await connectDB();

  // Verify access via membership
  const role = await getProjectRole(session.user.id, id);
  if (!role) notFound();

  const project = await Project.findById(id).lean();
  if (!project) notFound();

  // Tasks in shared projects belong to all members
  const tasks = await Task.find({ projectId: id })
    .sort({ order: 1 })
    .lean();

  const category = await Category.findById(project.categoryId).lean();

  // Fetch members
  const membersRaw = await ProjectMember.find({ projectId: id })
    .populate("userId", "name email image")
    .lean();

  const memberCount = membersRaw.length || 1;

  const taskCountsByColumn: Record<string, number> = {};
  for (const t of tasks) {
    taskCountsByColumn[t.columnId] =
      (taskCountsByColumn[t.columnId] || 0) + 1;
  }

  const serializedProject = {
    _id: project._id.toString(),
    name: project.name,
    description: project.description,
    categoryId: project.categoryId.toString(),
    userId: project.userId.toString(),
    columns: project.columns.map((c) => ({
      id: c.id,
      name: c.name,
      order: c.order,
    })),
    viewType: project.viewType ?? "board",
    archived: project.archived,
    currentUserRole: role,
    memberCount,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };

  const serializedMembers = membersRaw.map((m) => {
    const user = m.userId as unknown as {
      _id: { toString(): string };
      name: string;
      email: string;
      image?: string;
    };
    return {
      _id: m._id.toString(),
      projectId: m.projectId.toString(),
      userId: user._id.toString(),
      role: m.role,
      invitedBy: m.invitedBy.toString(),
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  });

  const serializedTasks = tasks.map((t) => ({
    _id: t._id.toString(),
    title: t.title,
    description: t.description,
    projectId: t.projectId.toString(),
    userId: t.userId.toString(),
    assigneeId: t.assigneeId?.toString() ?? null,
    columnId: t.columnId,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString(),
    order: t.order,
    labels: t.labels.map((l) => l.toString()),
    subtasks: (t.subtasks ?? []).map((s) => ({
      _id: s._id.toString(),
      title: s.title,
      completed: s.completed,
    })),
    recurrence: t.recurrence
      ? {
          frequency: t.recurrence.frequency,
          interval: t.recurrence.interval,
          endDate: t.recurrence.endDate?.toISOString(),
        }
      : undefined,
    statusHistory: (t.statusHistory ?? []).map((h) => ({
      columnId: h.columnId,
      timestamp: h.timestamp.toISOString(),
    })),
    completedAt: t.completedAt?.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <ProjectView
      project={serializedProject}
      initialTasks={serializedTasks}
      categoryName={category?.name}
      taskCounts={taskCountsByColumn}
      members={serializedMembers}
    />
  );
}
