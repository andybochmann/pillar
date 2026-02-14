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
import { startOfDay, endOfDay, addDays } from "date-fns";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  await connectDB();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  const userId = session.user.id;
  const baseFilter = { userId, completedAt: null };

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
        <Card className="relative overflow-hidden border-red-200 dark:border-red-900/50">
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

        <Card className="relative overflow-hidden border-amber-200 dark:border-amber-900/50">
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

        <Card className="relative overflow-hidden border-blue-200 dark:border-blue-900/50">
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
