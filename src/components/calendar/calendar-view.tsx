"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarDay } from "./calendar-day";
import { CalendarViewToggle } from "./calendar-view-toggle";
import {
  CalendarFilterBar,
  type CalendarFilters,
  type Assignee,
} from "./calendar-filter-bar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task, CalendarViewType, Label, Project } from "@/types";

const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarViewProps {
  tasks: Task[];
  labels: Label[];
  projectColors?: Map<string, string>;
  currentMonth: Date;
  viewType: CalendarViewType;
  filters: CalendarFilters;
  projects: Project[];
  assignees: Assignee[];
  onViewTypeChange: (viewType: CalendarViewType) => void;
  onFiltersChange: (filters: CalendarFilters) => void;
  onTaskClick: (task: Task) => void;
  onDateClick: (date: Date) => void;
  onTaskReschedule: (taskId: string, newDate: Date) => Promise<void>;
}

export function CalendarView({
  tasks,
  labels,
  projectColors,
  currentMonth,
  viewType,
  filters,
  projects,
  assignees,
  onViewTypeChange,
  onFiltersChange,
  onTaskClick,
  onDateClick,
  onTaskReschedule,
}: CalendarViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDate = (() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const dateKey = task.dueDate.slice(0, 10);
      const existing = map.get(dateKey) ?? [];
      existing.push(task);
      map.set(dateKey, existing);
    }
    return map;
  })();

  function getTasksForDate(date: Date): Task[] {
    const key = format(date, "yyyy-MM-dd");
    return tasksByDate.get(key) ?? [];
  }

  function navigateMonth(offset: number) {
    const newDate =
      offset > 0
        ? addMonths(currentMonth, offset)
        : subMonths(currentMonth, Math.abs(offset));
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", format(newDate, "yyyy-MM"));
    router.push(`/calendar?${params.toString()}`);
  }

  function goToToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    router.push(`/calendar?${params.toString()}`);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t._id === event.active.id);
    setActiveTask(task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    if (!overId.startsWith("date-")) return;

    const newDateStr = overId.replace("date-", "");
    const task = tasks.find((t) => t._id === taskId);
    if (!task?.dueDate) return;

    const currentDateStr = task.dueDate.slice(0, 10);
    if (currentDateStr === newDateStr) return;

    try {
      await onTaskReschedule(taskId, new Date(newDateStr + "T00:00:00Z"));
    } catch {
      toast.error("Failed to reschedule task");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <CalendarFilterBar
        filters={filters}
        onChange={onFiltersChange}
        projects={projects}
        labels={labels}
        assignees={assignees}
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-4">
          <CalendarViewToggle
            viewType={viewType}
            onChange={onViewTypeChange}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="rounded-lg border">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS_FULL.map((day, i) => (
              <div
                key={day}
                className="py-1 text-center text-xs font-medium text-muted-foreground sm:py-2 sm:text-sm"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayTasks = getTasksForDate(day);
              return (
                <CalendarDay
                  key={day.toISOString()}
                  date={day}
                  tasks={dayTasks}
                  labels={labels}
                  projectColors={projectColors}
                  isCurrentMonth={isSameMonth(day, currentMonth)}
                  onDateClick={onDateClick}
                  onTaskClick={onTaskClick}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <DraggableTaskPill task={activeTask} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* Wrapper to make task pills in CalendarDay draggable */
interface DraggableTaskPillProps {
  task: Task;
  isOverlay?: boolean;
}

function DraggableTaskPill({ task, isOverlay }: DraggableTaskPillProps) {
  const priorityColors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-blue-500",
    low: "bg-gray-400",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded bg-background border px-1.5 py-0.5 text-xs shadow-sm",
        isOverlay && "shadow-lg rotate-1",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          priorityColors[task.priority] ?? "bg-gray-400",
        )}
      />
      <span className="truncate">{task.title}</span>
    </div>
  );
}

export { DraggableTaskPill };
