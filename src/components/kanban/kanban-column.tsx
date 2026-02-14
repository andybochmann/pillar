"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { cn } from "@/lib/utils";
import type { Task, Column } from "@/types";

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: (title: string) => Promise<void>;
  onTaskClick: (task: Task) => void;
  labelColors?: Map<string, string>;
  selectedIds?: Set<string>;
  onSelect?: (taskId: string) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onTaskClick,
  labelColors,
  selectedIds,
  onSelect,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [showForm, setShowForm] = useState(false);

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
          onClick={() => setShowForm(true)}
          aria-label={`Add task to ${column.name}`}
        >
          +
        </Button>
      </div>

      {/* Task list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            onClick={() => onTaskClick(task)}
            labelColors={labelColors}
            selected={selectedIds?.has(task._id)}
            onSelect={onSelect}
          />
        ))}
        {tasks.length === 0 && !showForm && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No tasks yet
          </p>
        )}
        {showForm && (
          <TaskForm
            onSubmit={async (title) => {
              await onAddTask(title);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  );
}
