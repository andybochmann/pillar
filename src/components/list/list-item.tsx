"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toLocalDate } from "@/lib/date-utils";
import type { Task } from "@/types";

interface ListItemProps {
  task: Task;
  completed: boolean;
  onToggle?: (taskId: string) => void;
  onClick: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  memberNames?: Map<string, string>;
}

export function ListItem({
  task,
  completed,
  onToggle,
  onClick,
  onDelete,
  memberNames,
}: ListItemProps) {
  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 transition-colors">
      <Checkbox
        checked={completed}
        onCheckedChange={onToggle ? () => onToggle(task._id) : undefined}
        disabled={!onToggle}
        aria-label={`Mark "${task.title}" as ${completed ? "incomplete" : "complete"}`}
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onClick(task._id)}
      >
        <span
          className={cn(
            "truncate text-sm",
            completed && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
      </button>
      <div className="flex items-center gap-2">
        {task.dueDate && (
          <span className="text-xs text-muted-foreground">
            {format(toLocalDate(task.dueDate), "MMM d")}
          </span>
        )}
        {task.assigneeId && memberNames?.get(task.assigneeId) && (
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary"
            title={memberNames.get(task.assigneeId)}
          >
            {memberNames.get(task.assigneeId)!.charAt(0).toUpperCase()}
          </span>
        )}
        {completed && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task._id);
            }}
            aria-label={`Delete "${task.title}"`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
