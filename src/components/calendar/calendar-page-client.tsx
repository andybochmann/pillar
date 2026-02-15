"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView } from "./calendar-view";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarDayView } from "./calendar-day-view";
import { DayDetail } from "./day-detail";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { useTasks } from "@/hooks/use-tasks";
import { useLabels } from "@/hooks/use-labels";
import { useCategories } from "@/hooks/use-categories";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
import type { Task, Project, CalendarViewType } from "@/types";
import type { CalendarFilters } from "./calendar-filter-bar";
import { EMPTY_FILTERS } from "./calendar-filter-bar";

interface CalendarPageClientProps {
  initialTasks: Task[];
  projects: Project[];
  currentMonth: Date;
  initialViewType?: CalendarViewType;
  filters?: CalendarFilters;
}

export function CalendarPageClient({
  initialTasks,
  projects,
  currentMonth,
  initialViewType = "month",
  filters: initialFilters = EMPTY_FILTERS,
}: CalendarPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tasks, setTasks, updateTask, deleteTask } = useTasks(initialTasks);
  const { labels } = useLabels();
  const { categories } = useCategories();

  const [viewType, setViewType] = useState<CalendarViewType>(initialViewType);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(initialFilters);

  // Get columns for the selected task's project
  const selectedProject = selectedTask
    ? projects.find((p) => p._id === selectedTask.projectId)
    : null;

  // Create a map of project ID to category color
  const projectColors = useMemo(() => {
    const colorMap = new Map<string, string>();
    for (const project of projects) {
      const category = categories.find((c) => c._id === project.categoryId);
      if (category) {
        colorMap.set(project._id, category.color);
      }
    }
    return colorMap;
  }, [projects, categories]);

  const filteredTasks = useMemo(() => {
    const hasFilters =
      filters.projects.length > 0 ||
      filters.priorities.length > 0 ||
      filters.labels.length > 0 ||
      filters.assignees.length > 0;

    if (!hasFilters) return tasks;

    return tasks.filter((t) => {
      if (
        filters.projects.length > 0 &&
        !filters.projects.includes(t.projectId)
      )
        return false;
      if (
        filters.priorities.length > 0 &&
        !filters.priorities.includes(t.priority)
      )
        return false;
      if (
        filters.labels.length > 0 &&
        !filters.labels.some((l) => t.labels.includes(l))
      )
        return false;
      if (
        filters.assignees.length > 0 &&
        (!t.assigneeId || !filters.assignees.includes(t.assigneeId))
      )
        return false;

      return true;
    });
  }, [tasks, filters]);

  const assignees = useMemo(() => {
    const uniqueAssignees = new Map<
      string,
      { _id: string; name: string; email: string }
    >();
    for (const task of tasks) {
      if (task.assigneeId && task.assigneeName) {
        if (!uniqueAssignees.has(task.assigneeId)) {
          uniqueAssignees.set(task.assigneeId, {
            _id: task.assigneeId,
            name: task.assigneeName,
            email: "",
          });
        }
      }
    }
    return Array.from(uniqueAssignees.values());
  }, [tasks]);

  function getTasksForDate(date: Date): Task[] {
    const key = format(date, "yyyy-MM-dd");
    return filteredTasks.filter((t) => t.dueDate?.slice(0, 10) === key);
  }

  function handleDateClick(date: Date) {
    setSelectedDate(date);
    setDayDetailOpen(true);
  }

  function handleTaskClick(task: Task) {
    setSelectedTask(task);
    setTaskSheetOpen(true);
  }

  async function handleTaskReschedule(taskId: string, newDate: Date) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId ? { ...t, dueDate: newDate.toISOString() } : t,
      ),
    );

    try {
      await updateTask(taskId, { dueDate: newDate.toISOString() });
      toast.success("Task rescheduled");
    } catch {
      // Revert — refresh from server
      router.refresh();
      toast.error("Failed to reschedule task");
    }
  }

  async function handleTaskUpdate(id: string, data: Partial<Task>) {
    const updated = await updateTask(id, data);
    setSelectedTask(updated);

    // If completing a recurring task, show enhanced toast and refresh
    if (
      data.completedAt &&
      updated.recurrence?.frequency &&
      updated.recurrence.frequency !== "none" &&
      updated.dueDate
    ) {
      const nextDate = getNextDueDate(
        new Date(updated.dueDate),
        updated.recurrence.frequency,
        updated.recurrence.interval,
      );
      toast.success(
        `Task completed — next occurrence on ${format(nextDate, "MMM d, yyyy")}`,
      );
      // Refresh to pick up the spawned next occurrence from the server
      router.refresh();
    }

    return updated;
  }

  async function handleTaskDelete(id: string) {
    await deleteTask(id);
    setTaskSheetOpen(false);
    setSelectedTask(null);
  }

  async function handleCreateTaskFromDay(title: string, dueDate: string) {
    // Use first project's first column as default
    const defaultProject = projects[0];
    if (!defaultProject) {
      toast.error("Create a project first");
      return;
    }
    const columnId = defaultProject.columns[0]?.id ?? "todo";

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        projectId: defaultProject._id,
        columnId,
        dueDate,
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to create task");
    }

    const created: Task = await res.json();
    setTasks((prev) => [...prev, created]);
    toast.success("Task created");
  }

  function handleViewTypeChange(newViewType: CalendarViewType) {
    setViewType(newViewType);
    const params = new URLSearchParams(searchParams);
    params.set("view", newViewType);
    router.push(`/calendar?${params.toString()}`);
  }

  function handleFiltersChange(newFilters: CalendarFilters) {
    setFilters(newFilters);
  }

  return (
    <>
      {viewType === "month" ? (
        <CalendarView
          tasks={filteredTasks}
          labels={labels}
          projectColors={projectColors}
          currentMonth={currentMonth}
          viewType={viewType}
          filters={filters}
          projects={projects}
          assignees={assignees}
          onViewTypeChange={handleViewTypeChange}
          onFiltersChange={handleFiltersChange}
          onTaskClick={handleTaskClick}
          onDateClick={handleDateClick}
          onTaskReschedule={handleTaskReschedule}
        />
      ) : viewType === "week" ? (
        <CalendarWeekView
          tasks={filteredTasks}
          labels={labels}
          projectColors={projectColors}
          currentWeek={currentMonth}
          viewType={viewType}
          filters={filters}
          projects={projects}
          assignees={assignees}
          onViewTypeChange={handleViewTypeChange}
          onFiltersChange={handleFiltersChange}
          onTaskClick={handleTaskClick}
          onDateClick={handleDateClick}
          onTaskReschedule={handleTaskReschedule}
        />
      ) : viewType === "day" ? (
        <CalendarDayView
          tasks={filteredTasks}
          labels={labels}
          currentDay={currentMonth}
          viewType={viewType}
          filters={filters}
          projects={projects}
          assignees={assignees}
          onViewTypeChange={handleViewTypeChange}
          onFiltersChange={handleFiltersChange}
          onTaskClick={handleTaskClick}
          onTaskReschedule={handleTaskReschedule}
        />
      ) : null}

      <DayDetail
        date={selectedDate}
        tasks={selectedDate ? getTasksForDate(selectedDate) : []}
        projects={projects}
        open={dayDetailOpen}
        onOpenChange={setDayDetailOpen}
        onTaskClick={(task) => {
          setDayDetailOpen(false);
          handleTaskClick(task);
        }}
        onCreateTask={handleCreateTaskFromDay}
      />

      <TaskSheet
        task={selectedTask}
        columns={selectedProject?.columns ?? []}
        open={taskSheetOpen}
        onOpenChange={(open) => {
          setTaskSheetOpen(open);
          if (!open) setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />
    </>
  );
}

function getNextDueDate(
  currentDate: Date,
  frequency: string,
  interval: number,
): Date {
  switch (frequency) {
    case "daily":
      return addDays(currentDate, interval);
    case "weekly":
      return addWeeks(currentDate, interval);
    case "monthly":
      return addMonths(currentDate, interval);
    case "yearly":
      return addYears(currentDate, interval);
    default:
      return currentDate;
  }
}
