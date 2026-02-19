import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
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

  // Parse month from URL or use current month.
  // All calculations use UTC because due dates are stored as midnight UTC.
  let year: number, month: number, day: number;
  if (params.month && /^\d{4}-\d{2}-\d{2}$/.test(params.month)) {
    [year, month, day] = params.month.split("-").map(Number);
    month -= 1; // 0-indexed
  } else if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    [year, month] = params.month.split("-").map(Number);
    month -= 1;
    day = 1;
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth();
    day = now.getUTCDate();
  }

  const currentMonth = new Date(Date.UTC(year, month, day));

  // Calculate the visible date range in UTC (including overflow days from prev/next month)
  const monthStart = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthEnd = new Date(Date.UTC(year, month, lastDay));

  const startDow = monthStart.getUTCDay(); // 0 = Sunday
  const gridStart = new Date(Date.UTC(year, month, 1 - startDow));

  const endDow = monthEnd.getUTCDay(); // 6 = Saturday
  const gridEnd = new Date(Date.UTC(year, month, lastDay + (6 - endDow)));
  gridEnd.setUTCHours(23, 59, 59, 999);

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
