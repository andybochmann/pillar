"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import {
  BoardFilterBar,
  EMPTY_FILTERS,
  type BoardFilters,
} from "./board-filter-bar";
import { BulkActionsBar } from "./bulk-actions-bar";
import { useTasks } from "@/hooks/use-tasks";
import { useLabels } from "@/hooks/use-labels";
import { toast } from "sonner";
import { isToday, isBefore, startOfDay, endOfWeek } from "date-fns";
import type { Task, Column, Priority } from "@/types";

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
  const { labels: allLabels, createLabel } = useLabels();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [dndAnnouncement, setDndAnnouncement] = useState("");

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  );

  // Keyboard shortcut: "n" to open new task form in first column
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "n" && sortedColumns.length > 0) {
        e.preventDefault();
        setNewTaskColumnId(sortedColumns[0].id);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sortedColumns]);

  const labelColors = new Map(allLabels.map((l) => [l._id, l.color]));
  const labelNames = new Map(allLabels.map((l) => [l._id, l.name]));

  const filteredTasks = useMemo(() => {
    const hasFilters = filters.priorities.length > 0 || filters.labels.length > 0 || filters.dueDateRange !== null;
    if (!hasFilters) return tasks;

    return tasks.filter((t) => {
      if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority)) return false;
      if (filters.labels.length > 0 && !filters.labels.some((l) => t.labels.includes(l))) return false;

      if (filters.dueDateRange) {
        if (!t.dueDate) return false;

        const due = new Date(t.dueDate);
        const now = new Date();

        if (filters.dueDateRange === "overdue") {
          if (!isBefore(due, startOfDay(now))) return false;
        } else if (filters.dueDateRange === "today") {
          if (!isToday(due)) return false;
        } else if (filters.dueDateRange === "week") {
          if (isBefore(due, startOfDay(now)) || !isBefore(due, endOfWeek(now))) return false;
        }
      }

      return true;
    });
  }, [tasks, filters]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const getColumnTasks = useCallback(
    (columnId: string) =>
      filteredTasks
        .filter((t) => t.columnId === columnId)
        .sort((a, b) => a.order - b.order),
    [filteredTasks],
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t._id === event.active.id);
    setActiveTask(task ?? null);
    if (task) {
      setDndAnnouncement(`Picked up task: ${task.title}`);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskItem = tasks.find((t) => t._id === activeId);
    if (!activeTaskItem) return;

    const overTask = tasks.find((t) => t._id === overId);
    const targetColumnId = overTask ? overTask.columnId : sortedColumns.find((c) => c.id === overId) ? overId : null;

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
    if (!over) {
      setDndAnnouncement("Task dropped");
      return;
    }

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
        const res = await fetch("/api/tasks/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: updates.map((t) => ({ id: t._id, order: t.order })),
          }),
        });
        if (!res.ok) throw new Error("Failed to reorder");
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
      toast.error((err as Error).message);
      throw err;
    }
  }

  function handleTaskClick(task: Task) {
    setSelectedTask(task);
    setSheetOpen(true);
  }

  async function handlePriorityChange(taskId: string, priority: Priority) {
    try {
      await updateTask(taskId, { priority });
      toast.success(`Priority set to ${priority}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
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

  function toggleSelection(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function handleBulkMove(columnId: string) {
    const ids = [...selectedIds];
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ids, action: "move", columnId }),
      });
      if (!res.ok) throw new Error("Failed to move tasks");
      setTasks((prev) =>
        prev.map((t) => (ids.includes(t._id) ? { ...t, columnId } : t)),
      );
      setSelectedIds(new Set());
      toast.success(`Moved ${ids.length} tasks`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleBulkPriority(priority: Priority) {
    const ids = [...selectedIds];
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ids, action: "priority", priority }),
      });
      if (!res.ok) throw new Error("Failed to update priority");
      setTasks((prev) =>
        prev.map((t) => (ids.includes(t._id) ? { ...t, priority } : t)),
      );
      setSelectedIds(new Set());
      toast.success(`Updated ${ids.length} tasks`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ids, action: "delete" }),
      });
      if (!res.ok) throw new Error("Failed to delete tasks");
      setTasks((prev) => prev.filter((t) => !ids.includes(t._id)));
      setSelectedIds(new Set());
      toast.success(`Deleted ${ids.length} tasks`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BoardFilterBar
        filters={filters}
        onChange={setFilters}
        allLabels={allLabels}
      />
      <BulkActionsBar
        selectedCount={selectedIds.size}
        columns={columns}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkMove={handleBulkMove}
        onBulkPriority={handleBulkPriority}
        onBulkDelete={handleBulkDelete}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
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
                onPriorityChange={handlePriorityChange}
                labelColors={labelColors}
                labelNames={labelNames}
                selectedIds={selectedIds}
                onSelect={toggleSelection}
                showForm={newTaskColumnId === column.id}
                onFormOpenChange={(open) => {
                  if (!open) setNewTaskColumnId(null);
                }}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} isOverlay labelColors={labelColors} labelNames={labelNames} />
          ) : null}
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
        allLabels={allLabels}
        onCreateLabel={async (data) => {
          await createLabel(data);
        }}
      />

      {/* Screen reader announcements for DnD */}
      <div aria-live="assertive" className="sr-only" role="status">
        {dndAnnouncement}
      </div>
    </div>
  );
}
