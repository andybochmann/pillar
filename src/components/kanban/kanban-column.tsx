"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Inbox, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { cn } from "@/lib/utils";
import type { ContextAction } from "./task-card";
import type { Task, Column, Priority, Label as LabelType } from "@/types";

interface KanbanColumnProps {
  column: Column;
  columns: Column[];
  tasks: Task[];
  onAddTask: (title: string) => Promise<void>;
  onTaskClick: (task: Task) => void;
  onPriorityChange?: (taskId: string, priority: Priority) => void;
  onTitleSave?: (taskId: string, title: string) => Promise<void>;
  onDueDateChange?: (taskId: string, dueDate: string | null) => Promise<void>;
  onContextAction?: (taskId: string, action: ContextAction) => Promise<void>;
  allLabels?: LabelType[];
  labelColors?: Map<string, string>;
  labelNames?: Map<string, string>;
  memberNames?: Map<string, string>;
  selectedIds?: Set<string>;
  onSelect?: (taskId: string, shiftKey?: boolean) => void;
  showForm?: boolean;
  onFormOpenChange?: (open: boolean) => void;
  readOnly?: boolean;
  currentUserId?: string;
  onStartTracking?: (taskId: string) => void;
  onStopTracking?: (taskId: string) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string) => void;
  isLastColumn?: boolean;
  onArchiveAll?: () => void;
  onArchive?: (taskId: string) => void;
  focusedTaskId?: string | null;
}

export function KanbanColumn({
  column,
  columns,
  tasks,
  onAddTask,
  onTaskClick,
  onPriorityChange,
  onTitleSave,
  onDueDateChange,
  onContextAction,
  allLabels,
  labelColors,
  labelNames,
  memberNames,
  selectedIds,
  onSelect,
  showForm: showFormProp,
  onFormOpenChange,
  readOnly,
  currentUserId,
  onStartTracking,
  onStopTracking,
  onSubtaskToggle,
  isLastColumn,
  onArchiveAll,
  onArchive,
  focusedTaskId,
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
        "flex w-64 min-w-[16rem] flex-shrink-0 flex-col rounded-lg bg-muted/50 p-3 sm:w-72 sm:min-w-[18rem]",
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
        <div className="flex items-center gap-1">
          {isLastColumn && onArchiveAll && tasks.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onArchiveAll}
              aria-label="Archive all done tasks"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setShowForm(true)}
              aria-label={`Add task to ${column.name}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            onClick={() => onTaskClick(task)}
            onPriorityChange={onPriorityChange}
            onTitleSave={onTitleSave}
            onDueDateChange={onDueDateChange}
            onContextAction={onContextAction}
            columns={columns}
            allLabels={allLabels}
            labelColors={labelColors}
            labelNames={labelNames}
            memberNames={memberNames}
            selected={selectedIds?.has(task._id)}
            onSelect={onSelect}
            currentUserId={currentUserId}
            onStartTracking={onStartTracking}
            onStopTracking={onStopTracking}
            onSubtaskToggle={onSubtaskToggle}
            isLastColumn={isLastColumn}
            onArchive={onArchive}
            focused={focusedTaskId === task._id}
          />
        ))}
        {tasks.length === 0 && !showForm && (
          <div className="flex flex-col items-center py-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-xs text-muted-foreground">No tasks yet</p>
            {!readOnly && (
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs"
                onClick={() => setShowForm(true)}
              >
                Add a task
              </Button>
            )}
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
