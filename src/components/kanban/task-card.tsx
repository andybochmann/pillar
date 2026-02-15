"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ListChecks } from "lucide-react";
import { isToday, isPast, isThisWeek, format } from "date-fns";
import { TimeTrackingButton } from "@/components/tasks/time-tracking-button";
import type { Task, Subtask, Priority } from "@/types";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  onClick?: () => void;
  onPriorityChange?: (taskId: string, priority: Priority) => void;
  labelColors?: Map<string, string>;
  labelNames?: Map<string, string>;
  memberNames?: Map<string, string>;
  selected?: boolean;
  onSelect?: (taskId: string) => void;
  currentUserId?: string;
  onStartTracking?: (taskId: string) => void;
  onStopTracking?: (taskId: string) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string) => void;
}

const priorities: Priority[] = ["urgent", "high", "medium", "low"];

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
  onPriorityChange,
  labelColors,
  labelNames,
  memberNames,
  selected,
  onSelect,
  currentUserId,
  onStartTracking,
  onStopTracking,
  onSubtaskToggle,
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

  const activeSession = task.timeSessions?.find((s) => !s.endedAt);
  const isCurrentUserActive =
    !!currentUserId &&
    !!activeSession &&
    activeSession.userId === currentUserId;
  const isOtherUserActive = !!activeSession && !isCurrentUserActive;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group/card cursor-grab active:cursor-grabbing py-0 gap-0",
        isDragging && "opacity-50",
        isOverlay && "shadow-lg rotate-2",
        onClick && "cursor-pointer hover:ring-1 hover:ring-primary/20",
        selected && "ring-2 ring-primary",
      )}
    >
      <CardContent className="px-3 py-2 space-y-1.5">
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
          {onPriorityChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Badge
                  className={cn("text-xs cursor-pointer", priority.className)}
                  tabIndex={0}
                >
                  {priority.label}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onClick={(e) => e.stopPropagation()}
              >
                {priorities.map((p) => {
                  const config = priorityConfig[p];
                  return (
                    <DropdownMenuItem
                      key={p}
                      onClick={() => onPriorityChange(task._id, p)}
                    >
                      <span
                        className={cn(
                          "mr-2 inline-block h-2 w-2 rounded-full",
                          config.className,
                        )}
                      />
                      {config.label}
                      {task.priority === p && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge className={cn("text-xs", priority.className)}>
              {priority.label}
            </Badge>
          )}
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
          {task.subtasks?.length > 0 && (() => {
            const completed = task.subtasks.filter((s) => s.completed).length;
            const total = task.subtasks.length;
            const allDone = completed === total;
            const badge = (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
                  allDone
                    ? "text-green-600 bg-green-50"
                    : "text-muted-foreground bg-muted",
                  onSubtaskToggle && "cursor-pointer",
                )}
              >
                <ListChecks className="h-3 w-3" />
                {completed}/{total}
              </span>
            );
            if (!onSubtaskToggle) return badge;
            return (
              <Popover>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                  {badge}
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-64 p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    {task.subtasks.map((subtask: Subtask) => (
                      <label
                        key={subtask._id}
                        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={subtask.completed}
                          onCheckedChange={() =>
                            onSubtaskToggle(task._id, subtask._id)
                          }
                        />
                        <span
                          className={cn(
                            "text-sm",
                            subtask.completed && "line-through text-muted-foreground",
                          )}
                        >
                          {subtask.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })()}
          {currentUserId && onStartTracking && onStopTracking && (
            <TimeTrackingButton
              taskId={task._id}
              isActive={isCurrentUserActive}
              isOtherUserActive={isOtherUserActive}
              activeStartedAt={isCurrentUserActive ? activeSession?.startedAt : null}
              onStart={onStartTracking}
              onStop={onStopTracking}
            />
          )}
          {task.labels.map((labelId) => {
            const color = labelColors?.get(labelId);
            const name = labelNames?.get(labelId);
            if (!name) return null;
            return (
              <Badge
                key={labelId}
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
                {name}
              </Badge>
            );
          })}
          {task.assigneeId && memberNames && (() => {
            const assigneeName = memberNames.get(task.assigneeId!);
            if (!assigneeName) return null;
            return (
              <span
                className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary"
                title={assigneeName}
              >
                {assigneeName.charAt(0).toUpperCase()}
              </span>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
