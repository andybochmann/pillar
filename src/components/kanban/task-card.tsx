"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { isToday, isPast, isThisWeek, format } from "date-fns";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  onClick?: () => void;
  labelColors?: Map<string, string>;
  selected?: boolean;
  onSelect?: (taskId: string) => void;
}

const priorityConfig = {
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

function getDueDateStyle(dueDateStr?: string) {
  if (!dueDateStr) return null;
  const dueDate = new Date(dueDateStr);
  if (isPast(dueDate) && !isToday(dueDate))
    return {
      label: format(dueDate, "MMM d"),
      className: "text-red-600 bg-red-50",
    };
  if (isToday(dueDate))
    return { label: "Today", className: "text-orange-600 bg-orange-50" };
  if (isThisWeek(dueDate))
    return {
      label: format(dueDate, "EEE"),
      className: "text-yellow-600 bg-yellow-50",
    };
  return {
    label: format(dueDate, "MMM d"),
    className: "text-muted-foreground bg-muted",
  };
}

export function TaskCard({
  task,
  isOverlay,
  onClick,
  labelColors,
  selected,
  onSelect,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityConfig[task.priority];
  const dueDateStyle = getDueDateStyle(task.dueDate);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        isOverlay && "shadow-lg rotate-2",
        onClick && "cursor-pointer hover:ring-1 hover:ring-primary/20",
        selected && "ring-2 ring-primary",
      )}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {onSelect && (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onSelect(task._id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${task.title}`}
                className="mt-0.5"
              />
            )}
            <p className="text-sm font-medium leading-snug">{task.title}</p>
          </div>
          {task.recurrence?.frequency &&
            task.recurrence.frequency !== "none" && (
              <span
                className="text-xs text-muted-foreground"
                title="Recurring task"
              >
                ↻
              </span>
            )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={cn("text-xs", priority.className)}>
            {priority.label}
          </Badge>
          {dueDateStyle && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-xs font-medium",
                dueDateStyle.className,
              )}
            >
              {dueDateStyle.label}
            </span>
          )}
          {task.labels.map((label) => {
            const color = labelColors?.get(label);
            return (
              <Badge
                key={label}
                variant="outline"
                className="text-xs"
                style={
                  color
                    ? {
                        backgroundColor: color + "20",
                        color,
                        borderColor: color,
                      }
                    : undefined
                }
              >
                {label}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
