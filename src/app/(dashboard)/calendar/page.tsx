import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  parse,
} from "date-fns";
import type {
  Task as TaskType,
  Project as ProjectType,
  CalendarViewType,
} from "@/types";

interface CalendarPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();

  const params = await searchParams;

  // Parse view type from URL or use month as default
  const viewParam = params.view;
  const validViews: CalendarViewType[] = ["month", "week", "day"];
  const viewType: CalendarViewType =
    viewParam && validViews.includes(viewParam as CalendarViewType)
      ? (viewParam as CalendarViewType)
      : "month";

  // Parse month from URL or use current month
  // Supports both yyyy-MM (month view) and yyyy-MM-dd (week/day views)
  let currentMonth: Date;
  if (params.month && /^\d{4}-\d{2}-\d{2}$/.test(params.month)) {
    currentMonth = parse(params.month, "yyyy-MM-dd", new Date());
  } else if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    currentMonth = parse(params.month, "yyyy-MM", new Date());
  } else {
    currentMonth = new Date();
  }

  // Calculate the visible date range (including overflow days from prev/next month)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const [tasksRaw, projectsRaw] = await Promise.all([
    Task.find({
      userId: session.user.id,
      dueDate: { $gte: gridStart, $lte: gridEnd },
    })
      .sort({ dueDate: 1, order: 1 })
      .lean(),
    Project.find({ userId: session.user.id, archived: false })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const tasks: TaskType[] = JSON.parse(JSON.stringify(tasksRaw));
  const projects: ProjectType[] = JSON.parse(JSON.stringify(projectsRaw));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">View tasks by due date</p>
      </div>

      <CalendarPageClient
        initialTasks={tasks}
        projects={projects}
        currentMonth={currentMonth}
        initialViewType={viewType}
      />
    </div>
  );
}
