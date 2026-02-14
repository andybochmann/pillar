import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { redirect, notFound } from "next/navigation";
import { ProjectView } from "@/components/projects/project-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  await connectDB();

  const project = await Project.findOne({
    _id: id,
    userId: session.user.id,
  }).lean();

  if (!project) notFound();

  const tasks = await Task.find({
    projectId: id,
    userId: session.user.id,
  })
    .sort({ order: 1 })
    .lean();

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
    archived: project.archived,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };

  const serializedTasks = tasks.map((t) => ({
    _id: t._id.toString(),
    title: t.title,
    description: t.description,
    projectId: t.projectId.toString(),
    userId: t.userId.toString(),
    columnId: t.columnId,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString(),
    order: t.order,
    labels: t.labels,
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
    completedAt: t.completedAt?.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <ProjectView project={serializedProject} initialTasks={serializedTasks} />
  );
}
