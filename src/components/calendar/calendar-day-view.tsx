"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { addDays, format, isToday, parse } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarViewToggle } from "./calendar-view-toggle";
import { TaskHoverCard } from "./task-hover-card";
import {
  CalendarFilterBar,
  type CalendarFilters,
  type Assignee,
} from "./calendar-filter-bar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task, CalendarViewType, Label, Project } from "@/types";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

interface CalendarDayViewProps {
  tasks: Task[];
  labels: Label[];
  currentDay: Date;
  viewType: CalendarViewType;
  filters: CalendarFilters;
  projects: Project[];
  assignees: Assignee[];
  onViewTypeChange: (viewType: CalendarViewType) => void;
  onFiltersChange: (filters: CalendarFilters) => void;
  onTaskClick: (task: Task) => void;
  onTaskReschedule: (taskId: string, newDate: Date) => Promise<void>;
}

export function CalendarDayView({
  tasks,
  labels,
  currentDay,
  viewType,
  filters,
  projects,
  assignees,
  onViewTypeChange,
  onFiltersChange,
  onTaskClick,
  onTaskReschedule,
}: CalendarDayViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const dayKey = format(currentDay, "yyyy-MM-dd");
  const dayTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate.startsWith(dayKey),
  );

  // Separate all-day tasks (00:00:00) from timed tasks
  const allDayTasks = dayTasks.filter((t) => {
    if (!t.dueDate) return false;
    const time = t.dueDate.slice(11, 19);
    return time === "00:00:00";
  });

  const timedTasks = dayTasks.filter((t) => {
    if (!t.dueDate) return false;
    const time = t.dueDate.slice(11, 19);
    return time !== "00:00:00";
  });

  // Group timed tasks by hour
  const tasksByHour = new Map<number, Task[]>();
  for (const task of timedTasks) {
    if (!task.dueDate) continue;
    const hour = parseInt(task.dueDate.slice(11, 13), 10);
    const existing = tasksByHour.get(hour) ?? [];
    existing.push(task);
    tasksByHour.set(hour, existing);
  }

  function navigateDay(offset: number) {
    const monthParam = searchParams.get("month");
    let current: Date;
    if (monthParam) {
      current = /^\d{4}-\d{2}-\d{2}$/.test(monthParam)
        ? parse(monthParam, "yyyy-MM-dd", new Date(2000, 0, 1))
        : parse(monthParam, "yyyy-MM", new Date(2000, 0, 1));
    } else {
      current = currentDay;
    }
    const newDate = addDays(current, offset);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", format(newDate, "yyyy-MM-dd"));
    router.push(`/calendar?${params.toString()}`);
  }

  function goToToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    router.push(`/calendar?`);
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

    const task = tasks.find((t) => t._id === taskId);
    if (!task?.dueDate) return;

    let newDate: Date;
    if (overId === "all-day") {
      // Move to all-day (00:00:00)
      newDate = new Date(
        Date.UTC(
          currentDay.getFullYear(),
          currentDay.getMonth(),
          currentDay.getDate(),
          0,
          0,
          0,
        ),
      );
    } else if (overId.startsWith("hour-")) {
      // Move to specific hour
      const hour = parseInt(overId.replace("hour-", ""), 10);
      newDate = new Date(
        Date.UTC(
          currentDay.getFullYear(),
          currentDay.getMonth(),
          currentDay.getDate(),
          hour,
          0,
          0,
        ),
      );
    } else {
      return;
    }

    // Check if date actually changed
    if (task.dueDate === newDate.toISOString()) return;

    try {
      await onTaskReschedule(taskId, newDate);
    } catch {
      toast.error("Failed to reschedule task");
    }
  }

  const currentHour = isToday(currentDay) ? new Date().getHours() : -1;

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

      {/* Day navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">
          <span className="sm:hidden">
            {format(currentDay, "EEE, MMM d, yyyy")}
          </span>
          <span className="max-sm:hidden sm:inline">
            {format(currentDay, "EEEE, MMMM d, yyyy")}
          </span>
        </h2>
        <div className="flex items-center justify-between gap-4">
          <CalendarViewToggle viewType={viewType} onChange={onViewTypeChange} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDay(-1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDay(1)}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Day view with time slots */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="rounded-lg border overflow-auto max-h-[calc(100vh-12rem)]">
          {/* All-day section */}
          <AllDaySection
            tasks={allDayTasks}
            labels={labels}
            onTaskClick={onTaskClick}
          />

          {/* Time slots */}
          <div className="relative">
            {HOURS.map((hour) => {
              const hourTasks = tasksByHour.get(hour) ?? [];
              const isCurrent = hour === currentHour;
              return (
                <TimeSlot
                  key={hour}
                  hour={hour}
                  tasks={hourTasks}
                  labels={labels}
                  isCurrent={isCurrent}
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

interface AllDaySectionProps {
  tasks: Task[];
  labels: Label[];
  onTaskClick: (task: Task) => void;
}

function AllDaySection({ tasks, labels, onTaskClick }: AllDaySectionProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "all-day" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-b bg-muted/20 p-2 min-h-12 transition-colors",
        isOver && "bg-accent/40",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground mb-1">
        All Day
      </div>
      <div className="space-y-1">
        {tasks.map((task) => (
          <DraggableTask
            key={task._id}
            task={task}
            labels={labels}
            onClick={() => onTaskClick(task)}
          />
        ))}
      </div>
    </div>
  );
}

interface TimeSlotProps {
  hour: number;
  tasks: Task[];
  labels: Label[];
  isCurrent: boolean;
  onTaskClick: (task: Task) => void;
}

function TimeSlot({
  hour,
  tasks,
  labels,
  isCurrent,
  onTaskClick,
}: TimeSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour-${hour}` });

  const formattedHour = format(new Date(2000, 0, 1, hour, 0), "h:00 a");

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex border-b min-h-16 transition-colors relative",
        isOver && "bg-accent/40",
      )}
    >
      {/* Time label */}
      <div className="w-20 shrink-0 border-r px-2 py-1 text-xs text-muted-foreground">
        {formattedHour}
      </div>

      {/* Tasks area */}
      <div className="flex-1 p-1 space-y-1 relative">
        {isCurrent && (
          <div className="absolute inset-x-0 top-0 h-px bg-red-500" />
        )}
        {tasks.map((task) => (
          <DraggableTask
            key={task._id}
            task={task}
            labels={labels}
            onClick={() => onTaskClick(task)}
          />
        ))}
      </div>
    </div>
  );
}

interface DraggableTaskProps {
  task: Task;
  labels: Label[];
  onClick: () => void;
}

function DraggableTask({ task, labels, onClick }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id,
  });

  return (
    <TaskHoverCard task={task} labels={labels}>
      <button
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent transition-colors cursor-grab active:cursor-grabbing border",
          task.completedAt && "line-through opacity-60",
          isDragging && "opacity-50",
        )}
        title={task.title}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            priorityColors[task.priority] ?? "bg-gray-400",
          )}
        />
        <span className="flex-1 truncate">{task.title}</span>
        {task.recurrence?.frequency && task.recurrence.frequency !== "none" && (
          <span className="shrink-0 text-xs text-muted-foreground">↻</span>
        )}
      </button>
    </TaskHoverCard>
  );
}
