"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";

interface Column {
  id: string;
  name: string;
  order: number;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  columnId: string;
  priority: "urgent" | "high" | "medium" | "low";
  dueDate?: string;
  order: number;
  labels: string[];
  recurrence?: { frequency: string };
}

interface KanbanBoardProps {
  projectId: string;
  columns: Column[];
  initialTasks: Task[];
}

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

export function KanbanBoard({
  projectId,
  columns,
  initialTasks,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  const getColumnTasks = useCallback(
    (columnId: string) =>
      tasks
        .filter((t) => t.columnId === columnId)
        .sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            a.order - b.order,
        ),
    [tasks],
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t._id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskItem = tasks.find((t) => t._id === activeId);
    if (!activeTaskItem) return;

    // Determine target column
    const overTask = tasks.find((t) => t._id === overId);
    const targetColumnId = overTask
      ? overTask.columnId
      : sortedColumns.find((c) => c.id === overId)
        ? overId
        : null;

    if (!targetColumnId || activeTaskItem.columnId === targetColumnId) return;

    // Move task to new column (optimistic)
    setTasks((prev) =>
      prev.map((t) =>
        t._id === activeId ? { ...t, columnId: targetColumnId } : t,
      ),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const task = tasks.find((t) => t._id === activeId);
    if (!task) return;

    // Persist the move to the API
    try {
      await fetch(`/api/tasks/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId: task.columnId,
          order: task.order,
        }),
      });
    } catch {
      // Revert on failure — reload tasks
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (res.ok) setTasks(await res.json());
    }
  }

  async function handleAddTask(columnId: string) {
    const title = prompt("Task title:");
    if (!title?.trim()) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          projectId,
          columnId,
        }),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks((prev) => [...prev, newTask]);
      }
    } catch {
      // Task creation failed
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedColumns.map((column) => (
          <SortableContext
            key={column.id}
            items={getColumnTasks(column.id).map((t) => t._id)}
            strategy={horizontalListSortingStrategy}
          >
            <KanbanColumn
              column={column}
              tasks={getColumnTasks(column.id)}
              onAddTask={() => handleAddTask(column.id)}
            />
          </SortableContext>
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
