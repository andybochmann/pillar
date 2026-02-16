"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListItem } from "./list-item";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useTasks } from "@/hooks/use-tasks";
import { useLabels } from "@/hooks/use-labels";
import { offlineFetch } from "@/lib/offline-fetch";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { Task, Column, ProjectMember } from "@/types";

interface ListViewProps {
  projectId: string;
  columns: Column[];
  initialTasks: Task[];
  members?: ProjectMember[];
  readOnly?: boolean;
  onTasksChange?: (tasks: Task[]) => void;
}

export function ListView({
  projectId,
  columns,
  initialTasks,
  members,
  readOnly,
  onTasksChange,
}: ListViewProps) {
  const { tasks, createTask, updateTask, deleteTask, duplicateTask } = useTasks(
    initialTasks,
    projectId,
  );
  useEffect(() => {
    onTasksChange?.(tasks);
  }, [tasks, onTasksChange]);

  const { labels, createLabel } = useLabels();
  const [quickAddValue, setQuickAddValue] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  );
  const firstColumnId = sortedColumns[0]?.id ?? "todo";
  const lastColumnId = sortedColumns[sortedColumns.length - 1]?.id ?? "done";

  const activeTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.columnId !== lastColumnId)
        .sort((a, b) => a.order - b.order),
    [tasks, lastColumnId],
  );

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.columnId === lastColumnId)
        .sort((a, b) => a.order - b.order),
    [tasks, lastColumnId],
  );

  const memberNames = useMemo(() => {
    if (!members) return undefined;
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.userName) map.set(m.userId, m.userName);
    }
    return map;
  }, [members]);

  const handleQuickAdd = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const title = quickAddValue.trim();
      if (!title) return;

      try {
        await createTask({
          title,
          projectId,
          columnId: firstColumnId,
        });
        setQuickAddValue("");
      } catch {
        toast.error("Failed to add item");
      }
    },
    [quickAddValue, projectId, firstColumnId, createTask],
  );

  const handleToggle = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t._id === taskId);
      if (!task) return;

      const isCompleted = task.columnId === lastColumnId;
      try {
        await updateTask(taskId, {
          columnId: isCompleted ? firstColumnId : lastColumnId,
          completedAt: isCompleted ? null : new Date().toISOString(),
        });
      } catch {
        toast.error("Failed to update item");
      }
    },
    [tasks, firstColumnId, lastColumnId, updateTask],
  );

  const handleClick = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t._id === taskId);
      if (task) {
        setSelectedTask(task);
        setSheetOpen(true);
      }
    },
    [tasks],
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      try {
        await deleteTask(taskId);
      } catch {
        toast.error("Failed to delete item");
      }
    },
    [deleteTask],
  );

  const handleDeleteAllCompleted = useCallback(async () => {
    if (completedTasks.length === 0) return;

    try {
      await offlineFetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          taskIds: completedTasks.map((t) => t._id),
        }),
      });
      // Refetch will happen via sync event; optimistic removal
      for (const t of completedTasks) {
        await deleteTask(t._id);
      }
      toast.success("Completed items deleted");
    } catch {
      toast.error("Failed to delete completed items");
    }
    setShowDeleteAllConfirm(false);
  }, [completedTasks, deleteTask]);

  const handleTaskUpdate = useCallback(
    async (id: string, data: Partial<Task>) => {
      const updated = await updateTask(id, data);
      setSelectedTask(updated);
    },
    [updateTask],
  );

  const handleTaskDelete = useCallback(
    async (id: string) => {
      await deleteTask(id);
      setSheetOpen(false);
      setSelectedTask(null);
    },
    [deleteTask],
  );

  const handleTaskDuplicate = useCallback(
    async (task: Task) => {
      try {
        await duplicateTask(task._id);
        toast.success("Task duplicated");
        setSheetOpen(false);
        setSelectedTask(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to duplicate task");
      }
    },
    [duplicateTask],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Quick-add input */}
      {!readOnly && (
        <Input
          placeholder="Add an item…"
          value={quickAddValue}
          onChange={(e) => setQuickAddValue(e.target.value)}
          onKeyDown={handleQuickAdd}
          className="mb-2"
        />
      )}

      {/* Active items */}
      <div className="space-y-0.5">
        {activeTasks.map((task) => (
          <ListItem
            key={task._id}
            task={task}
            completed={false}
            onToggle={readOnly ? undefined : handleToggle}
            onClick={handleClick}
            onDelete={readOnly ? undefined : handleDelete}
            memberNames={memberNames}
          />
        ))}
      </div>

      {/* Completed section */}
      {completedTasks.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between px-3 py-1">
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCompletedExpanded(!completedExpanded)}
            >
              {completedExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Completed <span className="text-xs">({completedTasks.length})</span>
            </button>
            {completedExpanded && !readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                onClick={() => setShowDeleteAllConfirm(true)}
                aria-label="Delete completed items"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete completed
              </Button>
            )}
          </div>
          {completedExpanded && (
            <div className="space-y-0.5">
              {completedTasks.map((task) => (
                <ListItem
                  key={task._id}
                  task={task}
                  completed={true}
                  onToggle={readOnly ? undefined : handleToggle}
                  onClick={handleClick}
                  onDelete={readOnly ? undefined : handleDelete}
                  memberNames={memberNames}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task detail sheet */}
      <TaskSheet
        task={selectedTask}
        columns={columns}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        onDuplicate={readOnly ? undefined : handleTaskDuplicate}
        allLabels={labels}
        onCreateLabel={async (data) => { await createLabel(data); }}
        members={members}
      />

      {/* Delete all completed confirmation */}
      <ConfirmDialog
        open={showDeleteAllConfirm}
        onOpenChange={setShowDeleteAllConfirm}
        title="Delete completed items?"
        description={`This will permanently delete ${completedTasks.length} completed item${completedTasks.length === 1 ? "" : "s"}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteAllCompleted}
      />
    </div>
  );
}
