"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView } from "./calendar-view";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarDayView } from "./calendar-day-view";
import { DayDetail } from "./day-detail";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
import type { Task, Project, CalendarViewType } from "@/types";

interface CalendarPageClientProps {
  initialTasks: Task[];
  projects: Project[];
  currentMonth: Date;
  initialViewType?: CalendarViewType;
}

export function CalendarPageClient({
  initialTasks,
  projects,
  currentMonth,
  initialViewType = "month",
}: CalendarPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tasks, setTasks, updateTask, deleteTask } = useTasks(initialTasks);

  const [viewType, setViewType] = useState<CalendarViewType>(initialViewType);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);

  // Get columns for the selected task's project
  const selectedProject = selectedTask
    ? projects.find((p) => p._id === selectedTask.projectId)
    : null;

  function getTasksForDate(date: Date): Task[] {
    const key = format(date, "yyyy-MM-dd");
    return tasks.filter((t) => t.dueDate?.slice(0, 10) === key);
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

  return (
    <>
      {viewType === "month" ? (
        <CalendarView
          tasks={tasks}
          currentMonth={currentMonth}
          viewType={viewType}
          onViewTypeChange={handleViewTypeChange}
          onTaskClick={handleTaskClick}
          onDateClick={handleDateClick}
          onTaskReschedule={handleTaskReschedule}
        />
      ) : viewType === "week" ? (
        <CalendarWeekView
          tasks={tasks}
          currentWeek={currentMonth}
          viewType={viewType}
          onViewTypeChange={handleViewTypeChange}
          onTaskClick={handleTaskClick}
          onDateClick={handleDateClick}
          onTaskReschedule={handleTaskReschedule}
        />
      ) : viewType === "day" ? (
        <CalendarDayView
          tasks={tasks}
          currentDay={currentMonth}
          viewType={viewType}
          onViewTypeChange={handleViewTypeChange}
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
