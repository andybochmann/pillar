"use client";

import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";

interface Column {
  id: string;
  name: string;
  order: number;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  columnId: string;
  priority: "urgent" | "high" | "medium" | "low";
  dueDate?: string;
  order: number;
  labels: string[];
  recurrence?: { frequency: string };
}

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: () => void;
}

export function KanbanColumn({ column, tasks, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 p-3",
        isOver && "ring-2 ring-primary/30",
      )}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{column.name}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onAddTask}
          aria-label={`Add task to ${column.name}`}
        >
          +
        </Button>
      </div>

      {/* Task list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No tasks yet
          </p>
        )}
      </div>
    </div>
  );
}
