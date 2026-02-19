import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { Label } from "@/models/label";
import { TaskFilters } from "@/components/overview/task-filters";
import { TaskList } from "@/components/overview/task-list";
import { startOfDayUTC, endOfDayUTC } from "@/lib/date-utils";
import type { SortOrder } from "mongoose";
import type {
  Task as TaskType,
  Project as ProjectType,
  Label as LabelType,
} from "@/types";

interface OverviewPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function OverviewPage({
  searchParams,
}: OverviewPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();

  const params = await searchParams;

  const filter: Record<string, unknown> = { userId: session.user.id };

  if (params.projectId) filter.projectId = params.projectId;
  if (params.priority) filter.priority = { $in: params.priority.split(",") };
  if (params.labels) filter.labels = { $in: params.labels.split(",") };

  if (params.completed === "true") filter.completedAt = { $ne: null };
  else if (params.completed !== "all") filter.completedAt = null;

  if (params.dueDateFrom || params.dueDateTo) {
    const dateFilter: Record<string, Date> = {};
    if (params.dueDateFrom) dateFilter.$gte = startOfDayUTC(params.dueDateFrom);
    if (params.dueDateTo) dateFilter.$lte = endOfDayUTC(params.dueDateTo);
    filter.dueDate = dateFilter;
  }

  let sort: Record<string, SortOrder> = { order: 1 };
  const sortOrder: SortOrder = params.sortOrder === "desc" ? -1 : 1;
  if (params.sortBy === "dueDate") sort = { dueDate: sortOrder, order: 1 };
  else if (params.sortBy === "priority")
    sort = { priority: sortOrder, order: 1 };
  else if (params.sortBy === "createdAt") sort = { createdAt: sortOrder };

  const [tasksRaw, projectsRaw, labelsRaw] = await Promise.all([
    Task.find(filter).sort(sort).lean(),
    Project.find({ userId: session.user.id, archived: false })
      .sort({ createdAt: -1 })
      .lean(),
    Label.find({ userId: session.user.id }).lean(),
  ]);

  const tasks: TaskType[] = JSON.parse(JSON.stringify(tasksRaw));
  const projects: ProjectType[] = JSON.parse(JSON.stringify(projectsRaw));
  const labels: LabelType[] = JSON.parse(JSON.stringify(labelsRaw));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">All tasks across your projects</p>
      </div>

      <Suspense>
        <TaskFilters projects={projects} />
      </Suspense>

      <TaskList tasks={tasks} projects={projects} labels={labels} />
    </div>
  );
}
