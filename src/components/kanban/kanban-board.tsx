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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import type { Task, Column } from "@/types";

interface KanbanBoardProps {
  projectId: string;
  columns: Column[];
  initialTasks: Task[];
}

export function KanbanBoard({
  projectId,
  columns,
  initialTasks,
}: KanbanBoardProps) {
  const { tasks, setTasks, createTask, updateTask, deleteTask } =
    useTasks(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
        .sort((a, b) => a.order - b.order),
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

    const overTask = tasks.find((t) => t._id === overId);
    const targetColumnId = overTask
      ? overTask.columnId
      : sortedColumns.find((c) => c.id === overId)
        ? overId
        : null;

    if (!targetColumnId) return;

    // Cross-column move: update columnId
    if (activeTaskItem.columnId !== targetColumnId) {
      setTasks((prev) =>
        prev.map((t) =>
          t._id === activeId ? { ...t, columnId: targetColumnId } : t,
        ),
      );
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const task = tasks.find((t) => t._id === activeId);
    if (!task) return;

    // Compute new order for the column the task is now in
    const columnTasks = tasks
      .filter((t) => t.columnId === task.columnId)
      .sort((a, b) => a.order - b.order);

    const oldIndex = columnTasks.findIndex((t) => t._id === activeId);
    const newIndex = columnTasks.findIndex((t) => t._id === overId);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Reorder within column
      const reordered = arrayMove(columnTasks, oldIndex, newIndex);
      const updates = reordered.map((t, i) => ({ ...t, order: i }));

      setTasks((prev) => {
        const otherTasks = prev.filter((t) => t.columnId !== task.columnId);
        return [...otherTasks, ...updates];
      });

      // Persist to API
      try {
        await fetch("/api/tasks/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: updates.map((t) => ({ id: t._id, order: t.order })),
          }),
        });
      } catch {
        // Revert on failure
        const res = await fetch(`/api/tasks?projectId=${projectId}`);
        if (res.ok) setTasks(await res.json());
      }
    } else {
      // Cross-column move — just persist the columnId change
      try {
        await updateTask(activeId, {
          columnId: task.columnId,
          order: task.order,
        });
      } catch {
        const res = await fetch(`/api/tasks?projectId=${projectId}`);
        if (res.ok) setTasks(await res.json());
      }
    }
  }

  async function handleAddTask(columnId: string, title: string) {
    try {
      await createTask({ title, projectId, columnId });
      toast.success("Task created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
      throw err;
    }
  }

  function handleTaskClick(task: Task) {
    setSelectedTask(task);
    setSheetOpen(true);
  }

  async function handleTaskUpdate(id: string, data: Partial<Task>) {
    const updated = await updateTask(id, data);
    setSelectedTask(updated);
  }

  async function handleTaskDelete(id: string) {
    await deleteTask(id);
    setSheetOpen(false);
    setSelectedTask(null);
  }

  return (
    <>
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
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                column={column}
                tasks={getColumnTasks(column.id)}
                onAddTask={(title) => handleAddTask(column.id, title)}
                onTaskClick={handleTaskClick}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <TaskSheet
        task={selectedTask}
        columns={columns}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />
    </>
  );
}
