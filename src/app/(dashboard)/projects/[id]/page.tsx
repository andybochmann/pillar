import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { redirect, notFound } from "next/navigation";
import { KanbanBoard } from "@/components/kanban";

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

  const serializedTasks = tasks.map((t) => ({
    _id: t._id.toString(),
    title: t.title,
    description: t.description,
    columnId: t.columnId,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString(),
    order: t.order,
    labels: t.labels,
    recurrence: t.recurrence
      ? { frequency: t.recurrence.frequency }
      : undefined,
  }));

  const serializedColumns = project.columns.map((c) => ({
    id: c.id,
    name: c.name,
    order: c.order,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground">{project.description}</p>
        )}
      </div>
      <KanbanBoard
        projectId={id}
        columns={serializedColumns}
        initialTasks={serializedTasks}
      />
    </div>
  );
}
