import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  CalendarClock,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { NotificationPreference } from "@/models/notification-preference";
import {
  getCurrentDateInTimezone,
  startOfDayUTC,
  endOfDayUTC,
} from "@/lib/date-utils";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  await connectDB();

  const userId = session.user.id;
  const baseFilter = { userId, completedAt: null };

  // Use the user's timezone to determine "today" correctly.
  // Due dates are stored as midnight UTC, so we need UTC boundaries
  // for the calendar date that is "today" in the user's timezone.
  const prefs = await NotificationPreference.findOne({ userId }).lean();
  const timezone = prefs?.timezone || "UTC";
  const now = new Date();
  const todayStr = getCurrentDateInTimezone(timezone, now);
  const todayStart = startOfDayUTC(todayStr);
  const todayEnd = endOfDayUTC(todayStr);

  // Compute relative dates using UTC arithmetic (avoids server-local tz issues)
  const todayUTC = startOfDayUTC(todayStr);
  const yesterdayUTC = new Date(todayUTC.getTime() - 86_400_000);
  const weekEndUTC = new Date(todayUTC.getTime() + 7 * 86_400_000);
  const yesterday = yesterdayUTC.toISOString().slice(0, 10);
  const weekEndStr = weekEndUTC.toISOString().slice(0, 10);
  const weekEnd = endOfDayUTC(weekEndStr);

  const overdueHref = `/overview?dueDateTo=${yesterday}&sortBy=dueDate&sortOrder=asc`;
  const dueTodayHref = `/overview?dueDateFrom=${todayStr}&dueDateTo=${todayStr}&sortBy=dueDate&sortOrder=asc`;
  const dueThisWeekHref = `/overview?dueDateFrom=${todayStr}&dueDateTo=${weekEndStr}&sortBy=dueDate&sortOrder=asc`;

  const [overdue, dueToday, dueThisWeek] = await Promise.all([
    Task.countDocuments({
      ...baseFilter,
      dueDate: { $lt: todayStart },
    }),
    Task.countDocuments({
      ...baseFilter,
      dueDate: { $gte: todayStart, $lte: todayEnd },
    }),
    Task.countDocuments({
      ...baseFilter,
      dueDate: { $gte: todayStart, $lte: weekEnd },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user?.name ?? "User"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href={overdueHref}>
          <Card className="relative overflow-hidden border-red-200 hover:shadow-md transition-shadow cursor-pointer dark:border-red-900/50">
            <div className="absolute inset-y-0 left-0 w-1 bg-red-500" />
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">
                  Overdue Tasks
                </CardTitle>
                <CardDescription>Tasks past their due date</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {overdue}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href={dueTodayHref}>
          <Card className="relative overflow-hidden border-amber-200 hover:shadow-md transition-shadow cursor-pointer dark:border-amber-900/50">
            <div className="absolute inset-y-0 left-0 w-1 bg-amber-500" />
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Due Today</CardTitle>
                <CardDescription>Tasks due today</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {dueToday}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href={dueThisWeekHref}>
          <Card className="relative overflow-hidden border-blue-200 hover:shadow-md transition-shadow cursor-pointer dark:border-blue-900/50">
            <div className="absolute inset-y-0 left-0 w-1 bg-blue-500" />
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">
                  Due This Week
                </CardTitle>
                <CardDescription>Tasks due in the next 7 days</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {dueThisWeek}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="flex gap-3">
        <Link href="/overview">
          <Button variant="outline" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            View All Tasks
          </Button>
        </Link>
        <Link href="/calendar">
          <Button variant="outline" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendar View
          </Button>
        </Link>
      </div>
    </div>
  );
}
