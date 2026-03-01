"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { toLocalDate } from "@/lib/date-utils";
import { useRouter } from "next/navigation";
import type { Task, Project, Label } from "@/types";

interface TaskListProps {
  tasks: Task[];
  projects: Project[];
  labels?: Label[];
}

const priorityConfig = {
  urgent: { label: "Urgent", className: "bg-red-500 text-white" },
  high: { label: "High", className: "bg-orange-500 text-white" },
  medium: { label: "Medium", className: "bg-blue-500 text-white" },
  low: { label: "Low", className: "bg-gray-400 text-white" },
};

const priorityDotColors = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

function getDueDateDisplay(dueDateStr?: string) {
  if (!dueDateStr) return null;
  const dueDate = toLocalDate(dueDateStr);
  const overdue = isPast(dueDate) && !isToday(dueDate);
  return {
    label: isToday(dueDate) ? "Today" : format(dueDate, "MMM d, yyyy"),
    className: overdue
      ? "text-red-600"
      : isToday(dueDate)
        ? "text-orange-600"
        : "text-muted-foreground",
  };
}

export function TaskList({ tasks, projects, labels = [] }: TaskListProps) {
  const router = useRouter();
  const projectMap = new Map(projects.map((p) => [p._id, p]));
  const labelMap = new Map(labels.map((l) => [l._id, l]));

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        No tasks match your filters
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
      </p>

      {/* Desktop: grid header */}
      <div className="max-md:hidden rounded-t-md border-x border-t md:grid md:grid-cols-[1fr_160px_80px_100px_160px] md:gap-4 md:px-4 md:py-2 md:text-xs md:font-medium md:text-muted-foreground">
        <span>Task</span>
        <span>Project</span>
        <span>Priority</span>
        <span>Due Date</span>
        <span>Labels</span>
      </div>

      {/* Task items */}
      <div className="flex flex-col gap-2 md:gap-0 md:rounded-b-md md:border-x md:border-b md:-mt-2">
        {tasks.map((task) => {
          const project = projectMap.get(task.projectId);
          const priority = priorityConfig[task.priority];
          const dueInfo = getDueDateDisplay(task.dueDate);

          return (
            <div
              key={task._id}
              data-testid={`task-${task._id}`}
              className="cursor-pointer rounded-md border p-3 hover:bg-accent/50 md:rounded-none md:border-x-0 md:border-t-0 md:border-b md:p-0 md:last:border-b-0"
              onClick={() => router.push(`/projects/${task.projectId}`)}
            >
              {/* Mobile layout */}
              <div className="md:hidden">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      priorityDotColors[task.priority],
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-medium",
                      task.completedAt && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-xs text-muted-foreground">
                  {project && <span>{project.name}</span>}
                  {dueInfo && (
                    <span className={dueInfo.className}>{dueInfo.label}</span>
                  )}
                  {task.labels.map((labelId) => {
                    const label = labelMap.get(labelId);
                    if (!label) return null;
                    return (
                      <span key={labelId} style={{ color: label.color }}>
                        {label.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Desktop layout */}
              <div className="max-md:hidden md:grid md:grid-cols-[1fr_160px_80px_100px_160px] md:items-center md:gap-4 md:px-4 md:py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      "truncate font-medium",
                      task.completedAt &&
                        "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {task.description}
                    </span>
                  )}
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {project?.name ?? "Unknown"}
                </span>
                <div>
                  <Badge className={cn("text-xs", priority.className)}>
                    {priority.label}
                  </Badge>
                </div>
                <div>
                  {dueInfo ? (
                    <span className={cn("text-sm", dueInfo.className)}>
                      {dueInfo.label}
                    </span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground/60">
                      No date
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {task.labels.map((labelId) => {
                    const label = labelMap.get(labelId);
                    if (!label) return null;
                    return (
                      <Badge
                        key={labelId}
                        variant="outline"
                        className="text-xs"
                        style={{
                          backgroundColor: label.color + "20",
                          color: label.color,
                          borderColor: label.color,
                        }}
                      >
                        {label.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
