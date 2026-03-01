"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Archive,
  Bell,
  CalendarIcon,
  Check,
  CheckCircle2,
  ListChecks,
  Pencil,
  RotateCcw,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { isToday, isPast, isThisWeek, format } from "date-fns";
import { toLocalDate } from "@/lib/date-utils";
import { TimeTrackingButton } from "@/components/tasks/time-tracking-button";
import { computeTotalTrackedTime } from "@/lib/time-format";
import type { Task, Subtask, Priority, Column, Label as LabelType } from "@/types";

export type ContextAction =
  | { type: "priority"; priority: Priority }
  | { type: "moveTo"; columnId: string }
  | { type: "toggleLabel"; labelId: string }
  | { type: "complete" }
  | { type: "reopen" }
  | { type: "archive" }
  | { type: "delete" };

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  onClick?: () => void;
  onPriorityChange?: (taskId: string, priority: Priority) => void;
  onTitleSave?: (taskId: string, title: string) => Promise<void>;
  onDueDateChange?: (taskId: string, dueDate: string | null) => Promise<void>;
  onContextAction?: (taskId: string, action: ContextAction) => Promise<void>;
  columns?: Column[];
  allLabels?: LabelType[];
  labelColors?: Map<string, string>;
  labelNames?: Map<string, string>;
  memberNames?: Map<string, string>;
  selected?: boolean;
  onSelect?: (taskId: string, shiftKey?: boolean) => void;
  currentUserId?: string;
  onStartTracking?: (taskId: string) => void;
  onStopTracking?: (taskId: string) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string) => void;
  isLastColumn?: boolean;
  onArchive?: (taskId: string) => void;
  focused?: boolean;
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
  const dueDate = toLocalDate(dueDateStr);
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
  onTitleSave,
  onDueDateChange,
  onContextAction,
  columns,
  allLabels,
  labelColors,
  labelNames,
  memberNames,
  selected,
  onSelect,
  currentUserId,
  onStartTracking,
  onStopTracking,
  onSubtaskToggle,
  isLastColumn,
  onArchive,
  focused,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id, disabled: isEditing });

  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      cardRef.current = node;
      setSortableRef(node);
    },
    [setSortableRef],
  );

  // Scroll focused card into view
  useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focused]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityConfig[task.priority];
  const dueDateStyle = getDueDateStyle(task.dueDate);

  const currentUserSession = task.timeSessions?.find(
    (s) => !s.endedAt && s.userId === currentUserId,
  );
  const isCurrentUserActive = !!currentUserId && !!currentUserSession;
  const isOtherUserActive =
    !isCurrentUserActive &&
    !!task.timeSessions?.some((s) => !s.endedAt && s.userId !== currentUserId);

  const completedSessions = (task.timeSessions ?? []).filter((s) => !!s.endedAt);
  const historicalMs = computeTotalTrackedTime(completedSessions);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveTitle = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === task.title) {
        setIsEditing(false);
        setEditValue(task.title);
        return;
      }
      setIsEditing(false);
      await onTitleSave?.(task._id, trimmed);
    },
    [task._id, task.title, onTitleSave],
  );

  function handleTitleDoubleClick(e: React.MouseEvent) {
    if (!onTitleSave) return;
    e.stopPropagation();
    setEditValue(task.title);
    setIsEditing(true);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle(editValue);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(task.title);
    }
  }

  function handleTitleBlur() {
    saveTitle(editValue);
  }

  const lastColumn = columns?.slice().sort((a, b) => a.order - b.order).at(-1);
  const isDone = task.columnId === lastColumn?.id || !!task.completedAt;

  const cardContent = (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-focused={focused || undefined}
      onClick={isEditing ? undefined : onClick}
      className={cn(
        "group/card cursor-grab active:cursor-grabbing py-0 gap-0 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30",
        isDragging && "opacity-50",
        isOverlay && "shadow-lg rotate-2",
        onClick && !isEditing && "cursor-pointer",
        selected && "ring-2 ring-primary",
        focused && !selected && "ring-2 ring-primary/60",
      )}
    >
      <CardContent className="px-3 py-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleBlur}
              onClick={(e) => e.stopPropagation()}
              aria-label="Edit task title"
              maxLength={200}
              className="text-sm font-medium leading-snug w-full bg-transparent border-b border-primary/50 outline-none py-0"
            />
          ) : (
            <p
              className="text-sm font-medium leading-snug group/title relative"
              onDoubleClick={handleTitleDoubleClick}
            >
              {task.title}
              {onTitleSave && (
                <Pencil
                  data-testid="inline-edit-icon"
                  className="inline-block ml-1 h-3 w-3 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity"
                />
              )}
            </p>
          )}
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

          {/* Due date badge with popover */}
          {onDueDateChange ? (
            <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
              <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                {dueDateStyle ? (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs font-medium cursor-pointer hover:ring-1 hover:ring-primary/30",
                      dueDateStyle.className,
                    )}
                  >
                    {dueDateStyle.label}
                  </span>
                ) : (
                  <span
                    data-testid="add-due-date"
                    className="inline-flex items-center rounded-md px-1 py-0.5 text-xs text-muted-foreground cursor-pointer opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-muted"
                  >
                    <CalendarIcon className="h-3 w-3" />
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Calendar
                  mode="single"
                  selected={task.dueDate ? toLocalDate(task.dueDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      onDueDateChange(task._id, date.toISOString());
                      setDueDateOpen(false);
                    }
                  }}
                />
                {task.dueDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1"
                    aria-label="Clear"
                    onClick={() => {
                      onDueDateChange(task._id, null);
                      setDueDateOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          ) : (
            dueDateStyle && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-xs font-medium",
                  dueDateStyle.className,
                )}
              >
                {dueDateStyle.label}
              </span>
            )
          )}

          {task.reminderAt && (
            <span
              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium text-violet-600 bg-violet-50"
              title={`Reminder: ${format(new Date(task.reminderAt), "MMM d, h:mm a")}`}
            >
              <Bell className="h-3 w-3" />
            </span>
          )}
          {task.subtasks?.length > 0 && (() => {
            const completed = task.subtasks.filter((s) => s.completed).length;
            const total = task.subtasks.length;
            const allDone = completed === total;
            const percentage = (completed / total) * 100;
            const badge = (
              <span
                data-testid="subtask-badge"
                className={cn(
                  "inline-flex flex-col gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
                  allDone
                    ? "text-green-600 bg-green-50"
                    : "text-muted-foreground bg-muted",
                  onSubtaskToggle && "cursor-pointer",
                )}
              >
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  {completed}/{total}
                </span>
                <div className="w-full h-1 bg-background rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      allDone ? "bg-green-600" : "bg-primary",
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
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
              activeStartedAt={isCurrentUserActive ? currentUserSession?.startedAt : null}
              totalTrackedMs={historicalMs}
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
          {isLastColumn && onArchive && (
            <button
              className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/card:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onArchive(task._id);
              }}
              aria-label={`Archive ${task.title}`}
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          {(task.assigneeId || onSelect) && (
            <span className="ml-auto inline-flex items-center gap-1.5">
              {task.assigneeId && memberNames && (() => {
                const assigneeName = memberNames.get(task.assigneeId!);
                if (!assigneeName) return null;
                return (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary"
                    title={assigneeName}
                  >
                    {assigneeName.charAt(0).toUpperCase()}
                  </span>
                );
              })()}
              {onSelect && (
                <Checkbox
                  checked={selected}
                  onClick={(e: ReactMouseEvent) => {
                    e.stopPropagation();
                    onSelect(task._id, e.shiftKey || undefined);
                  }}
                  aria-label={`Select ${task.title}`}
                />
              )}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (onContextAction && columns) {
    return (
      <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {cardContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {/* Priority submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              Priority
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {priorities.map((p) => {
                const config = priorityConfig[p];
                return (
                  <ContextMenuItem
                    key={p}
                    onClick={() => onContextAction(task._id, { type: "priority", priority: p })}
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
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Move to submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRight className="mr-2 h-4 w-4" />
              Move to
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {columns.map((col) => (
                <ContextMenuItem
                  key={col.id}
                  disabled={task.columnId === col.id}
                  onClick={() => onContextAction(task._id, { type: "moveTo", columnId: col.id })}
                >
                  {col.name}
                  {task.columnId === col.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Labels submenu */}
          {allLabels && allLabels.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                Labels
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {allLabels.map((label) => (
                  <ContextMenuCheckboxItem
                    key={label._id}
                    checked={task.labels.includes(label._id)}
                    onCheckedChange={() =>
                      onContextAction(task._id, { type: "toggleLabel", labelId: label._id })
                    }
                  >
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </ContextMenuCheckboxItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          <ContextMenuSeparator />

          {/* Complete / Reopen */}
          {isDone ? (
            <ContextMenuItem
              onClick={() => onContextAction(task._id, { type: "reopen" })}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onClick={() => onContextAction(task._id, { type: "complete" })}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Complete
            </ContextMenuItem>
          )}

          {/* Archive */}
          <ContextMenuItem
            onClick={() => onContextAction(task._id, { type: "archive" })}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Delete */}
          <ContextMenuItem
            variant="destructive"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{task.title}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onContextAction(task._id, { type: "delete" })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  return cardContent;
}
