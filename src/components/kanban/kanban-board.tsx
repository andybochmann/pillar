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
import { TaskCard, type ContextAction } from "./task-card";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { getCompletionForColumnChange } from "@/lib/column-completion";
import type { BoardFilters } from "./board-filter-bar";
import { BulkActionsBar } from "./bulk-actions-bar";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { isToday, isBefore, startOfDay, endOfWeek } from "date-fns";
import { toLocalDate } from "@/lib/date-utils";
import { useTimeTracking } from "@/hooks/use-time-tracking";
import { useKanbanKeyboardNav } from "@/hooks/use-kanban-keyboard-nav";
import { offlineFetch } from "@/lib/offline-fetch";
import type { Task, Column, Priority, ProjectMember, Label } from "@/types";

const PRIORITY_CYCLE: Priority[] = ["low", "medium", "high", "urgent"];

interface KanbanBoardProps {
  projectId: string;
  columns: Column[];
  initialTasks: Task[];
  members?: ProjectMember[];
  readOnly?: boolean;
  currentUserId?: string;
  onTasksChange?: (tasks: Task[]) => void;
  filters: BoardFilters;
  allLabels: Label[];
  onCreateLabel: (data: { name: string; color: string }) => Promise<void>;
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
  allLabels,
  onCreateLabel,
}: KanbanBoardProps) {
  const { tasks, setTasks, createTask, updateTask, deleteTask, duplicateTask, archiveTask } =
    useTasks(initialTasks, projectId);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [dndAnnouncement, setDndAnnouncement] = useState("");
  useEffect(() => {
    onTasksChange?.(tasks);
  }, [tasks, onTasksChange]);

  const {
    startTracking,
    stopTracking,
    deleteSession: deleteTimeSession,
  } = useTimeTracking(tasks, setTasks, currentUserId ?? "");

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
      if (document.querySelector("[role='dialog']")) return;
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
    const hasFilters =
      filters.priorities.length > 0 ||
      filters.labels.length > 0 ||
      filters.dueDateRange !== null;
    if (!hasFilters) return tasks;

    return tasks.filter((t) => {
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

      if (filters.dueDateRange) {
        if (!t.dueDate) return false;

        const due = toLocalDate(t.dueDate);
        const now = new Date();

        if (filters.dueDateRange === "overdue") {
          if (!isBefore(due, startOfDay(now))) return false;
        } else if (filters.dueDateRange === "today") {
          if (!isToday(due)) return false;
        } else if (filters.dueDateRange === "week") {
          if (isBefore(due, startOfDay(now)) || !isBefore(due, endOfWeek(now)))
            return false;
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

    const isCrossColumnMove =
      startColumn !== null && startColumn !== task.columnId;

    // Compute new order for the column the task is now in
    const columnTasks = tasks
      .filter((t) => t.columnId === task.columnId)
      .sort((a, b) => a.order - b.order);

    const oldIndex = columnTasks.findIndex((t) => t._id === activeId);
    const newIndex = columnTasks.findIndex((t) => t._id === overId);

    const needsReorder =
      oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex;

    if (needsReorder) {
      // Reorder within the destination column
      const reordered = arrayMove(columnTasks, oldIndex, newIndex);
      const updates = reordered.map((t, i) => ({ ...t, order: i }));

      setTasks((prev) => {
        const otherTasks = prev.filter((t) => t.columnId !== task.columnId);
        return [...otherTasks, ...updates];
      });

      // Persist reorder
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
        const res = await fetch(`/api/tasks?projectId=${projectId}`);
        if (res.ok) setTasks(await res.json());
      }
    }

    if (isCrossColumnMove) {
      // Persist the columnId change (and completedAt if applicable)
      const updateData: Partial<Task> = {
        columnId: task.columnId,
      };

      // If we didn't reorder above, also compute correct order for the new column
      if (!needsReorder) {
        const destinationTasks = columnTasks.filter((t) => t._id !== activeId);
        updateData.order = destinationTasks.length;
      } else {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        const newOrder = reordered.findIndex((t) => t._id === activeId);
        updateData.order = newOrder !== -1 ? newOrder : task.order;
      }

      const completedAt = getCompletionForColumnChange(
        startColumn,
        task.columnId,
        columns,
      );
      if (completedAt !== undefined) {
        updateData.completedAt = completedAt;
      }

      try {
        await updateTask(activeId, updateData);
      } catch {
        const res = await fetch(`/api/tasks?projectId=${projectId}`);
        if (res.ok) setTasks(await res.json());
      }
    } else if (!needsReorder) {
      // Same column, same position — no-op (dropped in place)
      setDndAnnouncement("Task dropped");
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
      toast.error(
        err instanceof Error ? err.message : "Failed to duplicate task",
      );
    }
  }

  async function handleStartTracking(taskId: string) {
    try {
      const updated = await startTracking(taskId);
      if (selectedTask?._id === taskId) setSelectedTask(updated);

      // Auto-move from first column to second when timer starts
      const firstColumn = sortedColumns[0];
      const secondColumn = sortedColumns[1];
      if (
        firstColumn &&
        secondColumn &&
        updated.columnId === firstColumn.id
      ) {
        const completedAt = getCompletionForColumnChange(
          firstColumn.id,
          secondColumn.id,
          columns,
        );
        const moveData: Partial<Task> = { columnId: secondColumn.id };
        if (completedAt !== undefined) {
          moveData.completedAt = completedAt;
        }
        const moved = await updateTask(taskId, moveData);
        if (selectedTask?._id === taskId) setSelectedTask(moved);
        toast.success(`Moved to ${secondColumn.name}`);
      }
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

  const lastClickedTaskRef = useRef<string | null>(null);

  function toggleSelection(taskId: string, shiftKey?: boolean) {
    if (shiftKey && lastClickedTaskRef.current) {
      // Range selection: select all tasks between last clicked and current within same column
      const currentTask = filteredTasks.find((t) => t._id === taskId);
      const lastTask = filteredTasks.find(
        (t) => t._id === lastClickedTaskRef.current,
      );
      if (currentTask && lastTask && currentTask.columnId === lastTask.columnId) {
        const columnTasks = filteredTasks
          .filter((t) => t.columnId === currentTask.columnId)
          .sort((a, b) => a.order - b.order);
        const startIdx = columnTasks.findIndex(
          (t) => t._id === lastClickedTaskRef.current,
        );
        const endIdx = columnTasks.findIndex((t) => t._id === taskId);
        const [from, to] =
          startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = from; i <= to; i++) {
            next.add(columnTasks[i]._id);
          }
          return next;
        });
        lastClickedTaskRef.current = taskId;
        return;
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
    lastClickedTaskRef.current = taskId;
  }

  // Ctrl+A / Cmd+A: select/deselect all visible tasks
  useEffect(() => {
    if (readOnly) return;
    function handleSelectAll(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (document.querySelector("[role='dialog']")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const visibleIds = filteredTasks
          .filter((t) => !t.archived)
          .map((t) => t._id);
        setSelectedIds((prev) => {
          const allSelected = visibleIds.every((id) => prev.has(id));
          return allSelected ? new Set() : new Set(visibleIds);
        });
      }
    }
    document.addEventListener("keydown", handleSelectAll);
    return () => document.removeEventListener("keydown", handleSelectAll);
  }, [filteredTasks, readOnly]);

  async function handleBulkMove(columnId: string) {
    const ids = [...selectedIds];
    try {
      const res = await offlineFetch("/api/tasks/bulk", {
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
      const res = await offlineFetch("/api/tasks/bulk", {
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
      const res = await offlineFetch("/api/tasks/bulk", {
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

  async function handleArchiveTask(taskId: string) {
    try {
      await archiveTask(taskId);
      toast.success("Task archived");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function bulkArchive(ids: string[]) {
    const res = await offlineFetch("/api/tasks/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: ids, action: "archive" }),
    });
    if (!res.ok) throw new Error("Failed to archive tasks");
    setTasks((prev) => prev.filter((t) => !ids.includes(t._id)));
    toast.success(`Archived ${ids.length} tasks`);
  }

  async function handleArchiveAll(columnId: string) {
    const ids = tasks.filter((t) => t.columnId === columnId).map((t) => t._id);
    if (ids.length === 0) return;
    try {
      await bulkArchive(ids);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleBulkArchive() {
    const ids = [...selectedIds];
    try {
      await bulkArchive(ids);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleBulkSetDueDate(date: Date) {
    const ids = [...selectedIds];
    try {
      const res = await offlineFetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: ids,
          action: "set-due-date",
          dueDate: date.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to set due date");
      setTasks((prev) =>
        prev.map((t) =>
          ids.includes(t._id) ? { ...t, dueDate: date.toISOString() } : t,
        ),
      );
      setSelectedIds(new Set());
      toast.success(`Set due date on ${ids.length} tasks`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleBulkAssign(assigneeId: string | null) {
    const ids = [...selectedIds];
    try {
      const res = await offlineFetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ids, action: "assign", assigneeId }),
      });
      if (!res.ok) throw new Error("Failed to assign tasks");
      setTasks((prev) =>
        prev.map((t) =>
          ids.includes(t._id)
            ? { ...t, assigneeId: assigneeId ?? undefined }
            : t,
        ),
      );
      setSelectedIds(new Set());
      toast.success(
        assigneeId
          ? `Assigned ${ids.length} tasks`
          : `Unassigned ${ids.length} tasks`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleBulkAddLabel(labelId: string) {
    const ids = [...selectedIds];
    try {
      const res = await offlineFetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ids, action: "add-label", labelId }),
      });
      if (!res.ok) throw new Error("Failed to add label");
      setTasks((prev) =>
        prev.map((t) =>
          ids.includes(t._id) && !t.labels.includes(labelId)
            ? { ...t, labels: [...t.labels, labelId] }
            : t,
        ),
      );
      setSelectedIds(new Set());
      toast.success(`Added label to ${ids.length} tasks`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleArchiveFromSheet(taskId: string) {
    await handleArchiveTask(taskId);
    setSheetOpen(false);
    setSelectedTask(null);
  }

  async function handleTitleSave(taskId: string, title: string) {
    try {
      await updateTask(taskId, { title });
      toast.success("Title updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDueDateChange(taskId: string, dueDate: string | null) {
    try {
      await updateTask(taskId, { dueDate: dueDate ?? undefined });
      toast.success(dueDate ? "Due date updated" : "Due date cleared");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleContextAction(taskId: string, action: ContextAction) {
    try {
      switch (action.type) {
        case "priority":
          await updateTask(taskId, { priority: action.priority });
          toast.success(`Priority set to ${action.priority}`);
          break;
        case "moveTo": {
          const task = tasks.find((t) => t._id === taskId);
          if (!task) return;
          const completedAt = getCompletionForColumnChange(
            task.columnId,
            action.columnId,
            columns,
          );
          const moveData: Partial<Task> = { columnId: action.columnId };
          if (completedAt !== undefined) moveData.completedAt = completedAt;
          await updateTask(taskId, moveData);
          const colName = columns.find((c) => c.id === action.columnId)?.name ?? action.columnId;
          toast.success(`Moved to ${colName}`);
          break;
        }
        case "toggleLabel": {
          const task = tasks.find((t) => t._id === taskId);
          if (!task) return;
          const hasLabel = task.labels.includes(action.labelId);
          const updatedLabels = hasLabel
            ? task.labels.filter((l) => l !== action.labelId)
            : [...task.labels, action.labelId];
          await updateTask(taskId, { labels: updatedLabels });
          break;
        }
        case "complete": {
          const lastCol = sortedColumns[sortedColumns.length - 1];
          if (!lastCol) return;
          const task = tasks.find((t) => t._id === taskId);
          if (!task) return;
          const completedAt = getCompletionForColumnChange(
            task.columnId,
            lastCol.id,
            columns,
          );
          const data: Partial<Task> = { columnId: lastCol.id };
          if (completedAt !== undefined) data.completedAt = completedAt;
          await updateTask(taskId, data);
          toast.success(`Moved to ${lastCol.name}`);
          break;
        }
        case "reopen": {
          const firstCol = sortedColumns[0];
          if (!firstCol) return;
          await updateTask(taskId, { columnId: firstCol.id, completedAt: undefined });
          toast.success(`Reopened to ${firstCol.name}`);
          break;
        }
        case "archive":
          await archiveTask(taskId);
          toast.success("Task archived");
          break;
        case "delete":
          await deleteTask(taskId);
          toast.success("Task deleted");
          break;
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleCyclePriority(taskId: string) {
    const task = filteredTasks.find((t) => t._id === taskId);
    if (!task) return;
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    handlePriorityChange(taskId, next);
  }

  async function handleToggleComplete(taskId: string) {
    const task = filteredTasks.find((t) => t._id === taskId);
    if (!task || sortedColumns.length === 0) return;
    const lastCol = sortedColumns[sortedColumns.length - 1];
    const firstCol = sortedColumns[0];
    if (task.columnId === lastCol.id) {
      // Move back to first column
      const completedAt = getCompletionForColumnChange(
        lastCol.id,
        firstCol.id,
        columns,
      );
      const data: Partial<Task> = { columnId: firstCol.id };
      if (completedAt !== undefined) data.completedAt = completedAt;
      try {
        await updateTask(taskId, data);
        toast.success(`Moved to ${firstCol.name}`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    } else {
      // Move to done column
      const completedAt = getCompletionForColumnChange(
        task.columnId,
        lastCol.id,
        columns,
      );
      const data: Partial<Task> = { columnId: lastCol.id };
      if (completedAt !== undefined) data.completedAt = completedAt;
      try {
        await updateTask(taskId, data);
        toast.success(`Moved to ${lastCol.name}`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
  }

  function handleOpenTaskById(taskId: string) {
    const task = filteredTasks.find((t) => t._id === taskId);
    if (task) handleTaskClick(task);
  }

  // Date picker via keyboard is a no-op at hook level — opening task sheet is sufficient
  function handleOpenDatePicker(taskId: string) {
    handleOpenTaskById(taskId);
  }

  const { focusedTaskId } = useKanbanKeyboardNav({
    tasks: filteredTasks,
    columns: sortedColumns,
    onOpenTask: handleOpenTaskById,
    onCyclePriority: handleCyclePriority,
    onToggleComplete: handleToggleComplete,
    onToggleSelect: toggleSelection,
    onOpenDatePicker: handleOpenDatePicker,
    disabled: readOnly || sheetOpen,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!readOnly && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          totalCount={filteredTasks.filter((t) => !t.archived).length}
          columns={columns}
          labels={allLabels}
          members={members}
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkMove={handleBulkMove}
          onBulkPriority={handleBulkPriority}
          onBulkArchive={handleBulkArchive}
          onBulkDelete={handleBulkDelete}
          onBulkSetDueDate={handleBulkSetDueDate}
          onBulkAssign={handleBulkAssign}
          onBulkAddLabel={handleBulkAddLabel}
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
                columns={sortedColumns}
                tasks={getColumnTasks(column.id)}
                onAddTask={(title) => handleAddTask(column.id, title)}
                onTaskClick={handleTaskClick}
                onPriorityChange={readOnly ? undefined : handlePriorityChange}
                onTitleSave={readOnly ? undefined : handleTitleSave}
                onDueDateChange={readOnly ? undefined : handleDueDateChange}
                onContextAction={readOnly ? undefined : handleContextAction}
                allLabels={readOnly ? undefined : allLabels}
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
                isLastColumn={!readOnly && column.id === sortedColumns[sortedColumns.length - 1]?.id}
                onArchiveAll={readOnly ? undefined : () => handleArchiveAll(column.id)}
                onArchive={readOnly ? undefined : handleArchiveTask}
                focusedTaskId={focusedTaskId}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              isOverlay
              labelColors={labelColors}
              labelNames={labelNames}
              memberNames={memberNames}
              currentUserId={currentUserId}
            />
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
        onCreateLabel={onCreateLabel}
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
        onArchive={readOnly ? undefined : handleArchiveFromSheet}
      />

      {/* Screen reader announcements for DnD */}
      <div aria-live="assertive" className="sr-only" role="status">
        {dndAnnouncement}
      </div>
    </div>
  );
}
