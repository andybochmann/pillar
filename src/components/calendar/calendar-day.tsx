"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";
import type { Task } from "@/types";

const MAX_VISIBLE_PILLS = 3;

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

interface CalendarDayProps {
  date: Date;
  tasks: Task[];
  isCurrentMonth: boolean;
  onDateClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
}

export function CalendarDay({
  date,
  tasks,
  isCurrentMonth,
  onDateClick,
  onTaskClick,
}: CalendarDayProps) {
  const dateId = date.toISOString().slice(0, 10);
  const { setNodeRef, isOver } = useDroppable({ id: `date-${dateId}` });

  const today = isToday(date);
  const visibleTasks = tasks.slice(0, MAX_VISIBLE_PILLS);
  const overflowCount = tasks.length - MAX_VISIBLE_PILLS;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-16 border-t p-0.5 transition-colors sm:min-h-24 sm:p-1",
        !isCurrentMonth && "bg-muted/30 text-muted-foreground",
        isOver && "bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={() => onDateClick(date)}
        className={cn(
          "mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs sm:mb-1 sm:h-7 sm:w-7 sm:text-sm",
          today && "bg-primary text-primary-foreground font-bold",
          !today && "hover:bg-accent",
        )}
        aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
      >
        {date.getDate()}
      </button>
      <div className="space-y-0.5">
        {visibleTasks.map((task) => (
          <DraggableTaskPill
            key={task._id}
            task={task}
            onClick={() => onTaskClick(task)}
          />
        ))}
        {overflowCount > 0 && (
          <button
            type="button"
            onClick={() => onDateClick(date)}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-1"
          >
            +{overflowCount} more
          </button>
        )}
      </div>
    </div>
  );
}

interface DraggableTaskPillProps {
  task: Task;
  onClick: () => void;
}

function DraggableTaskPill({ task, onClick }: DraggableTaskPillProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id,
  });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-accent truncate cursor-grab active:cursor-grabbing",
        task.completedAt && "line-through opacity-60",
        isDragging && "opacity-50",
      )}
      title={task.title}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          priorityColors[task.priority] ?? "bg-gray-400",
        )}
      />
      <span className="truncate">{task.title}</span>
      {task.recurrence?.frequency && task.recurrence.frequency !== "none" && (
        <span className="shrink-0 text-muted-foreground">↻</span>
      )}
    </button>
  );
}
