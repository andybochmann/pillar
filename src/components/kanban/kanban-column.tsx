"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Inbox } from "lucide-react";
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
  showForm?: boolean;
  onFormOpenChange?: (open: boolean) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onTaskClick,
  labelColors,
  selectedIds,
  onSelect,
  showForm: showFormProp,
  onFormOpenChange,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [localShowForm, setLocalShowForm] = useState(false);
  const showForm = showFormProp || localShowForm;

  function setShowForm(open: boolean) {
    setLocalShowForm(open);
    onFormOpenChange?.(open);
  }

  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={`${column.name} column, ${tasks.length} tasks`}
      className={cn(
        "flex w-72 min-w-[18rem] flex-shrink-0 flex-col rounded-lg bg-muted/50 p-3",
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
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => setShowForm(true)}
          aria-label={`Add task to ${column.name}`}
        >
          <Plus className="h-4 w-4" />
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
          <div className="flex flex-col items-center py-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-xs text-muted-foreground">No tasks yet</p>
            <Button
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => setShowForm(true)}
            >
              Add a task
            </Button>
          </div>
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
