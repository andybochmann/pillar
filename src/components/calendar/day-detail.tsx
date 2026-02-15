"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Task, Project } from "@/types";

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: {
    label: "Urgent",
    className: "bg-red-500 text-white hover:bg-red-600",
  },
  high: {
    label: "High",
    className: "bg-orange-500 text-white hover:bg-orange-600",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-500 text-white hover:bg-blue-600",
  },
  low: { label: "Low", className: "bg-gray-400 text-white hover:bg-gray-500" },
};

interface DayDetailProps {
  date: Date | null;
  tasks: Task[];
  projects: Project[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskClick: (task: Task) => void;
  onCreateTask: (title: string, dueDate: string) => Promise<void>;
}

export function DayDetail({
  date,
  tasks,
  projects,
  open,
  onOpenChange,
  onTaskClick,
  onCreateTask,
}: DayDetailProps) {
  if (!date) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{format(date, "EEEE, MMMM d, yyyy")}</SheetTitle>
        </SheetHeader>
        <DayDetailContent
          key={date.toISOString()}
          date={date}
          tasks={tasks}
          projects={projects}
          onTaskClick={onTaskClick}
          onCreateTask={onCreateTask}
        />
      </SheetContent>
    </Sheet>
  );
}

interface DayDetailContentProps {
  date: Date;
  tasks: Task[];
  projects: Project[];
  onTaskClick: (task: Task) => void;
  onCreateTask: (title: string, dueDate: string) => Promise<void>;
}

function DayDetailContent({
  date,
  tasks,
  projects,
  onTaskClick,
  onCreateTask,
}: DayDetailContentProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const projectMap = new Map(projects.map((p) => [p._id, p]));

  // Group tasks by project
  const grouped = new Map<
    string,
    { project: Project | undefined; tasks: Task[] }
  >();
  for (const task of tasks) {
    const entry = grouped.get(task.projectId) ?? {
      project: projectMap.get(task.projectId),
      tasks: [],
    };
    entry.tasks.push(task);
    grouped.set(task.projectId, entry);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    setCreating(true);
    try {
      const dueDate = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
      ).toISOString();
      await onCreateTask(title, dueDate);
      setNewTaskTitle("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks on this date</p>
      ) : (
        Array.from(grouped.values()).map(({ project, tasks: projectTasks }) => (
          <div key={project?._id ?? "unknown"}>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {project?.name ?? "Unknown project"}
            </h3>
            <div className="space-y-1">
              {projectTasks.map((task) => {
                const priority = priorityConfig[task.priority];
                return (
                  <button
                    key={task._id}
                    type="button"
                    onClick={() => onTaskClick(task)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent transition-colors",
                      task.completedAt && "opacity-60",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          task.completedAt && "line-through",
                        )}
                      >
                        {task.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.recurrence?.frequency &&
                        task.recurrence.frequency !== "none" && (
                          <span
                            className="text-xs text-muted-foreground"
                            title="Recurring task"
                          >
                            ↻
                          </span>
                        )}
                      {priority && (
                        <Badge className={cn("text-xs", priority.className)}>
                          {priority.label}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Separator />

      {/* Quick create */}
      <form onSubmit={handleCreateTask} className="flex gap-2">
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a task for this day…"
          disabled={creating}
          aria-label="New task title"
        />
        <Button
          type="submit"
          size="sm"
          disabled={creating || !newTaskTitle.trim()}
        >
          Add
        </Button>
      </form>
    </div>
  );
}
