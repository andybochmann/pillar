"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useBackButton } from "@/hooks/use-back-button";
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
  onCreateTask: (
    title: string,
    dueDate: string,
    projectId: string,
  ) => Promise<void>;
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
  useBackButton("day-detail", open, () => onOpenChange(false));

  if (!date) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>{format(date, "EEEE, MMMM d, yyyy")}</SheetTitle>
          <SheetDescription className="sr-only">Tasks for this day</SheetDescription>
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
  onCreateTask: (
    title: string,
    dueDate: string,
    projectId: string,
  ) => Promise<void>;
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
  const [targetProjectId, setTargetProjectId] = useState(
    projects[0]?._id ?? "",
  );

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
    if (!title || !targetProjectId) return;

    setCreating(true);
    try {
      const dueDate = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
      ).toISOString();
      await onCreateTask(title, dueDate, targetProjectId);
      setNewTaskTitle("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create task",
      );
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
      <form onSubmit={handleCreateTask} className="space-y-2">
        {projects.length > 0 && (
          <Select
            value={targetProjectId}
            onValueChange={setTargetProjectId}
            disabled={creating}
          >
            <SelectTrigger aria-label="Project for new task" className="w-full">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-2">
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
            disabled={creating || !newTaskTitle.trim() || !targetProjectId}
          >
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}
