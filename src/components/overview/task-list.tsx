"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
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

function getDueDateDisplay(dueDateStr?: string) {
  if (!dueDateStr) return null;
  const dueDate = new Date(dueDateStr);
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
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Task</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Labels</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const project = projectMap.get(task.projectId);
            const priority = priorityConfig[task.priority];
            const dueInfo = getDueDateDisplay(task.dueDate);

            return (
              <TableRow key={task._id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        "font-medium",
                        task.completedAt &&
                          "line-through text-muted-foreground",
                      )}
                    >
                      {task.title}
                    </span>
                    {task.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {task.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project?.name ?? "Unknown"}
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-xs", priority.className)}>
                    {priority.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {dueInfo ? (
                    <span className={cn("text-sm", dueInfo.className)}>
                      {dueInfo.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic">
                      No date
                    </span>
                  )}
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
