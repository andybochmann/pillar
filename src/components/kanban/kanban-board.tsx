"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
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
import { getCompletionForColumnChange } from "@/lib/column-completion";
import type { BoardFilters } from "./board-filter-bar";
import { BulkActionsBar } from "./bulk-actions-bar";
import { useTasks } from "@/hooks/use-tasks";
import { useLabels } from "@/hooks/use-labels";
import { toast } from "sonner";
import { isToday, isBefore, startOfDay, endOfWeek } from "date-fns";
import { useTimeTracking } from "@/hooks/use-time-tracking";
import type { Task, Column, Priority, ProjectMember } from "@/types";

interface KanbanBoardProps {
  projectId: string;
  columns: Column[];
  initialTasks: Task[];
  members?: ProjectMember[];
  readOnly?: boolean;
  currentUserId?: string;
  onTasksChange?: (tasks: Task[]) => void;
  filters: BoardFilters;
}

export function KanbanBoard({
  projectId,
  columns,
  initialTasks,
  members,
  readOnly,
  currentUserId,
  onTasksChange,
  filters,
}: KanbanBoardProps) {
  const { tasks, setTasks, createTask, updateTask, deleteTask, duplicateTask } =
    useTasks(initialTasks, projectId);
  const { labels: allLabels, createLabel } = useLabels();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [dndAnnouncement, setDndAnnouncement] = useState("");
  useEffect(() => {
    onTasksChange?.(tasks);
  }, [tasks, onTasksChange]);

  const { startTracking, stopTracking, deleteSession: deleteTimeSession } = useTimeTracking(
    tasks,
    setTasks,
    currentUserId ?? "",
  );

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  );

  const dragStartColumnRef = useRef<string | null>(null);

  // Keyboard shortcut: "n" to open new task form in first column
  useEffect(() => {
    if (readOnly) return;
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
  }, [sortedColumns, readOnly]);

  const labelColors = new Map(allLabels.map((l) => [l._id, l.color]));
  const labelNames = new Map(allLabels.map((l) => [l._id, l.name]));
  const memberNames = new Map(
    (members ?? []).map((m) => [m.userId, m.userName ?? ""]),
  );

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
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // pointerWithin detects empty columns reliably (pointer is inside the container rect),
  // closestCorners handles precise task-to-task reordering as fallback
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCorners(args);
  }, []);

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
    dragStartColumnRef.current = task?.columnId ?? null;
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
    const startColumn = dragStartColumnRef.current;
    dragStartColumnRef.current = null;

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
      // Cross-column move — persist columnId and sync completedAt
      const updateData: Partial<Task> = {
        columnId: task.columnId,
        order: task.order,
      };

      if (startColumn) {
        const completedAt = getCompletionForColumnChange(startColumn, task.columnId, columns);
        if (completedAt !== undefined) {
          updateData.completedAt = completedAt;
        }
      }

      try {
        await updateTask(activeId, updateData);
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

  async function handleSubtaskToggle(taskId: string, subtaskId: string) {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const updatedSubtasks = task.subtasks.map((s) =>
      s._id === subtaskId ? { ...s, completed: !s.completed } : s,
    );
    try {
      await updateTask(taskId, { subtasks: updatedSubtasks });
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

  async function handleTaskDuplicate(task: Task) {
    try {
      await duplicateTask(task._id);
      toast.success("Task duplicated");
      setSheetOpen(false);
      setSelectedTask(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate task");
    }
  }

  async function handleStartTracking(taskId: string) {
    try {
      const updated = await startTracking(taskId);
      if (selectedTask?._id === taskId) setSelectedTask(updated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleStopTracking(taskId: string) {
    try {
      const updated = await stopTracking(taskId);
      if (selectedTask?._id === taskId) setSelectedTask(updated);
    } catch (err) {
      toast.error((err as Error).message);
    }
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
      {!readOnly && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          columns={columns}
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkMove={handleBulkMove}
          onBulkPriority={handleBulkPriority}
          onBulkDelete={handleBulkDelete}
        />
      )}
      <DndContext
        id="kanban-dnd"
        sensors={readOnly ? [] : sensors}
        collisionDetection={collisionDetection}
        onDragStart={readOnly ? undefined : handleDragStart}
        onDragOver={readOnly ? undefined : handleDragOver}
        onDragEnd={readOnly ? undefined : handleDragEnd}
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
                onPriorityChange={readOnly ? undefined : handlePriorityChange}
                labelColors={labelColors}
                labelNames={labelNames}
                memberNames={memberNames}
                selectedIds={readOnly ? undefined : selectedIds}
                onSelect={readOnly ? undefined : toggleSelection}
                showForm={!readOnly && newTaskColumnId === column.id}
                onFormOpenChange={(open) => {
                  if (!open) setNewTaskColumnId(null);
                }}
                readOnly={readOnly}
                currentUserId={readOnly ? undefined : currentUserId}
                onStartTracking={readOnly ? undefined : handleStartTracking}
                onStopTracking={readOnly ? undefined : handleStopTracking}
                onSubtaskToggle={readOnly ? undefined : handleSubtaskToggle}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} isOverlay labelColors={labelColors} labelNames={labelNames} memberNames={memberNames} currentUserId={currentUserId} />
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
        onDuplicate={readOnly ? undefined : handleTaskDuplicate}
        allLabels={allLabels}
        onCreateLabel={async (data) => {
          await createLabel(data);
        }}
        members={members}
        currentUserId={currentUserId}
        onStartTracking={readOnly ? undefined : handleStartTracking}
        onStopTracking={readOnly ? undefined : handleStopTracking}
        onDeleteSession={
          readOnly
            ? undefined
            : async (taskId: string, sessionId: string) => {
                try {
                  const updated = await deleteTimeSession(taskId, sessionId);
                  setSelectedTask(updated);
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }
        }
      />

      {/* Screen reader announcements for DnD */}
      <div aria-live="assertive" className="sr-only" role="status">
        {dndAnnouncement}
      </div>
    </div>
  );
}
