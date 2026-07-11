"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { FolderKanban, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toLocalDate } from "@/lib/date-utils";
import { useAssignedTasks } from "@/hooks/use-assigned-tasks";
import {
  getDueBucket,
  groupByProject,
  groupByDueBucket,
} from "./my-work-grouping";
import type { Task, Project, Category } from "@/types";

interface MyWorkViewProps {
  userId: string;
  projects: Project[];
  categories: Category[];
}

type GroupMode = "project" | "due";

const priorityConfig: Record<
  Task["priority"],
  { label: string; className: string; dot: string }
> = {
  urgent: { label: "Urgent", className: "bg-red-500 text-white", dot: "bg-red-500" },
  high: { label: "High", className: "bg-orange-500 text-white", dot: "bg-orange-500" },
  medium: { label: "Medium", className: "bg-blue-500 text-white", dot: "bg-blue-500" },
  low: { label: "Low", className: "bg-gray-400 text-white", dot: "bg-gray-400" },
};

/**
 * Returns the due-date text (with an explicit "Overdue"/"Today" word so the
 * meaning is not conveyed by color alone) and a dark-mode-safe color class.
 */
function getDueDisplay(dueDate: string | null | undefined) {
  const bucket = getDueBucket(dueDate);
  if (bucket === "none" || !dueDate) return null;
  const formatted = format(toLocalDate(dueDate), "MMM d, yyyy");
  if (bucket === "overdue") {
    return {
      text: `Overdue · ${formatted}`,
      className: "text-red-600 dark:text-red-400 font-medium",
    };
  }
  if (bucket === "today") {
    return {
      text: `Today · ${formatted}`,
      className: "text-amber-600 dark:text-amber-400 font-medium",
    };
  }
  return { text: formatted, className: "text-muted-foreground" };
}

export function MyWorkView({ userId, projects, categories }: MyWorkViewProps) {
  const router = useRouter();
  const { tasks, loading, error, refetch } = useAssignedTasks(userId);
  const [groupMode, setGroupMode] = useState<GroupMode>("project");

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p._id, p])),
    [projects],
  );
  const categoryColor = useMemo(
    () => new Map(categories.map((c) => [c._id, c.color])),
    [categories],
  );

  const projectGroups = useMemo(
    () =>
      groupByProject(tasks, projects, (p) =>
        categoryColor.get(p.categoryId),
      ),
    [tasks, projects, categoryColor],
  );
  const dueGroups = useMemo(() => groupByDueBucket(tasks), [tasks]);

  function openTask(task: Task) {
    router.push(`/projects/${task.projectId}?taskId=${task._id}`);
  }

  function renderTask(task: Task, showProject: boolean) {
    const priority = priorityConfig[task.priority];
    const due = getDueDisplay(task.dueDate);
    const project = projectMap.get(task.projectId);
    return (
      <button
        key={task._id}
        type="button"
        data-testid={`task-${task._id}`}
        onClick={() => openTask(task)}
        aria-label={`Open task ${task.title}`}
        className="flex w-full items-start gap-3 border-b p-3 text-left transition-colors last:border-b-0 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span
          aria-hidden="true"
          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priority.dot)}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">{task.title}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Badge className={cn("text-[10px]", priority.className)}>
              {priority.label}
            </Badge>
            {showProject && project && (
              <span className="text-muted-foreground">{project.name}</span>
            )}
            {due ? (
              <span className={due.className}>{due.text}</span>
            ) : (
              <span className="italic text-muted-foreground/60">No due date</span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Work</h1>
          <p className="text-muted-foreground">
            Open tasks assigned to you across all projects
          </p>
        </div>
        <div
          className="flex items-center gap-1 rounded-lg border p-1"
          role="group"
          aria-label="Group tasks by"
        >
          <Button
            type="button"
            size="sm"
            variant={groupMode === "project" ? "secondary" : "ghost"}
            aria-pressed={groupMode === "project"}
            onClick={() => setGroupMode("project")}
          >
            By project
          </Button>
          <Button
            type="button"
            size="sm"
            variant={groupMode === "due" ? "secondary" : "ghost"}
            aria-pressed={groupMode === "due"}
            onClick={() => setGroupMode("due")}
          >
            By due date
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading tasks">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No tasks assigned to you</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks assigned to you across your projects will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>

          {groupMode === "project"
            ? projectGroups.map((group) => (
                <section key={group.projectId} aria-label={group.projectName}>
                  <div className="mb-2 flex items-center gap-2">
                    {group.color ? (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                    ) : (
                      <FolderKanban
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      />
                    )}
                    <h2 className="text-sm font-semibold">{group.projectName}</h2>
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                      {group.tasks.length}
                    </Badge>
                  </div>
                  <div className="overflow-hidden rounded-md border">
                    {group.tasks.map((task) => renderTask(task, false))}
                  </div>
                </section>
              ))
            : dueGroups.map((group) => (
                <section key={group.bucket} aria-label={group.label}>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{group.label}</h2>
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                      {group.tasks.length}
                    </Badge>
                  </div>
                  <div className="overflow-hidden rounded-md border">
                    {group.tasks.map((task) => renderTask(task, true))}
                  </div>
                </section>
              ))}
        </div>
      )}
    </div>
  );
}
