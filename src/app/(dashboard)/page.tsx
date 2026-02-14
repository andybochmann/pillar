import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user?.name ?? "User"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <CardDescription>Tasks past their due date</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overdue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <CardDescription>Tasks due today</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dueToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
            <CardDescription>Tasks due in the next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dueThisWeek}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/overview">
          <Button variant="outline">View All Tasks</Button>
        </Link>
        <Link href="/calendar">
          <Button variant="outline">Calendar View</Button>
        </Link>
      </div>
    </div>
  );
}
