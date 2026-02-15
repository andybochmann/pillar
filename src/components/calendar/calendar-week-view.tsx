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
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { CalendarDay } from "./calendar-day";
import { CalendarViewToggle } from "./calendar-view-toggle";
import { toast } from "sonner";
import type { Task, CalendarViewType } from "@/types";

const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CalendarWeekViewProps {
  tasks: Task[];
  currentWeek: Date;
  viewType: CalendarViewType;
  onViewTypeChange: (viewType: CalendarViewType) => void;
  onTaskClick: (task: Task) => void;
  onDateClick: (date: Date) => void;
  onTaskReschedule: (taskId: string, newDate: Date) => Promise<void>;
}

export function CalendarWeekView({
  tasks,
  currentWeek,
  viewType,
  onViewTypeChange,
  onTaskClick,
  onDateClick,
  onTaskReschedule,
}: CalendarWeekViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

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

  function navigateWeek(offset: number) {
    const newDate =
      offset > 0
        ? addWeeks(currentWeek, offset)
        : subWeeks(currentWeek, Math.abs(offset));
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
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
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
              onClick={() => navigateWeek(-1)}
              aria-label="Previous week"
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek(1)}
              aria-label="Next week"
            >
              ›
            </Button>
          </div>
        </div>
      </div>

      {/* Week grid */}
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
                className="py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
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
                  isCurrentMonth={true}
                  onDateClick={onDateClick}
                  onTaskClick={onTaskClick}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rounded bg-background px-2 py-1 text-sm shadow-lg border">
              {activeTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
