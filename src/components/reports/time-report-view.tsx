"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimeReport } from "@/hooks/use-time-report";
import { formatDuration } from "@/lib/time-format";
import type { TimeReport } from "@/types";

const WEEK_OPTIONS = [4, 8, 12] as const;

function formatWeekLabel(weekStart: string): string {
  try {
    return format(parseISO(weekStart), "MMM d");
  } catch {
    return weekStart;
  }
}

interface BreakdownProps {
  report: TimeReport;
}

function ProjectBreakdown({ report }: BreakdownProps) {
  const { byProject, totalMs } = report;

  return (
    <Card>
      <CardHeader>
        <CardTitle>By project</CardTitle>
        <CardDescription>Share of tracked time per project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {byProject.map((project) => {
          const pct = totalMs > 0 ? (project.totalMs / totalMs) * 100 : 0;
          const label = `${project.projectName}: ${formatDuration(
            project.totalMs,
          )} (${Math.round(pct)}% of total)`;
          return (
            <div key={project.projectId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">
                  {project.projectName}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatDuration(project.totalMs)}
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={label}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function WeeklyTrend({ report }: BreakdownProps) {
  const { byWeek } = report;
  const maxMs = Math.max(...byWeek.map((w) => w.totalMs), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly trend</CardTitle>
        <CardDescription>Time tracked per ISO week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-2">
          {byWeek.map((week) => {
            const heightPct = (week.totalMs / maxMs) * 100;
            const label = `Week of ${formatWeekLabel(
              week.weekStart,
            )}: ${formatDuration(week.totalMs)}`;
            return (
              <div
                key={week.weekStart}
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
              >
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className="w-full max-w-8 rounded-t bg-primary"
                    style={{ height: `${heightPct}%` }}
                    role="img"
                    aria-label={label}
                  />
                </div>
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                  {formatWeekLabel(week.weekStart)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function TimeReportView() {
  const [weeks, setWeeks] = useState<number>(8);
  const { report, loading, error } = useTimeReport(weeks);

  const hasTrackedTime = report != null && report.totalMs > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time reports</h1>
          <p className="text-muted-foreground">
            Your tracked time across projects.
          </p>
        </div>
        <Select
          value={String(weeks)}
          onValueChange={(value) => setWeeks(Number(value))}
        >
          <SelectTrigger className="w-40" aria-label="Report time range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEK_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                Last {option} weeks
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && !report ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : report && hasTrackedTime ? (
        <>
          <Card>
            <CardHeader>
              <CardDescription>Total tracked</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatDuration(report.totalMs)}
              </CardTitle>
            </CardHeader>
          </Card>
          <ProjectBreakdown report={report} />
          <WeeklyTrend report={report} />
        </>
      ) : report ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium">No time tracked yet</p>
              <p className="text-sm text-muted-foreground">
                Start a timer on a task to see your report here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
