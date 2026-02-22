"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useArchivedTasks } from "@/hooks/use-archived-tasks";
import { toast } from "sonner";
import { Archive, ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Priority } from "@/types";

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-500 text-white" },
  high: { label: "High", className: "bg-orange-500 text-white" },
  medium: { label: "Medium", className: "bg-blue-500 text-white" },
  low: { label: "Low", className: "bg-gray-400 text-white" },
};

const OLDER_THAN_OPTIONS = [7, 14, 30, 60, 90] as const;

type BulkAction =
  | { type: "selected"; taskIds: string[] }
  | { type: "all"; count: number }
  | { type: "olderThan"; days: number };

interface ArchivedTasksSheetProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivedTasksSheet({
  projectId,
  open,
  onOpenChange,
}: ArchivedTasksSheetProps) {
  const {
    archivedTasks,
    loading,
    fetchArchived,
    unarchiveTask,
    permanentDeleteTask,
    bulkDeleteArchived,
  } = useArchivedTasks();
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(
    null,
  );

  const deleteTaskTitle =
    archivedTasks.find((t) => t._id === deleteTaskId)?.title ?? "";

  useEffect(() => {
    if (open) {
      fetchArchived(projectId);
      setSelectedIds(new Set());
    }
  }, [open, projectId, fetchArchived]);

  const sorted = useMemo(
    () =>
      [...archivedTasks].sort((a, b) => {
        const aDate = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
        const bDate = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
        return bDate - aDate;
      }),
    [archivedTasks],
  );

  const allSelected =
    sorted.length > 0 && selectedIds.size === sorted.length;

  const toggleTask = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((t) => t._id)));
    }
  }, [allSelected, sorted]);

  async function handleRestore(taskId: string) {
    try {
      await unarchiveTask(taskId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      toast.success("Task restored");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore task",
      );
    }
  }

  async function handleDelete() {
    if (!deleteTaskId) return;
    try {
      await permanentDeleteTask(deleteTaskId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTaskId);
        return next;
      });
      toast.success("Task permanently deleted");
      setDeleteTaskId(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete task",
      );
    }
  }

  async function handleBulkDelete() {
    if (!pendingBulkAction) return;
    try {
      let deletedCount: number;
      if (pendingBulkAction.type === "selected") {
        deletedCount = await bulkDeleteArchived({
          projectId,
          taskIds: pendingBulkAction.taskIds,
        });
      } else if (pendingBulkAction.type === "olderThan") {
        deletedCount = await bulkDeleteArchived({
          projectId,
          olderThanDays: pendingBulkAction.days,
        });
      } else {
        deletedCount = await bulkDeleteArchived({ projectId });
      }
      toast.success(
        `${deletedCount} task${deletedCount !== 1 ? "s" : ""} permanently deleted`,
      );
      setSelectedIds(new Set());
      setPendingBulkAction(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete tasks",
      );
    }
  }

  function getBulkConfirmDescription(): string {
    if (!pendingBulkAction) return "";
    if (pendingBulkAction.type === "selected") {
      const count = pendingBulkAction.taskIds.length;
      return `This will permanently delete ${count} archived task${count !== 1 ? "s" : ""}. This cannot be undone.`;
    }
    if (pendingBulkAction.type === "olderThan") {
      return `This will permanently delete all archived tasks older than ${pendingBulkAction.days} days. This cannot be undone.`;
    }
    return `This will permanently delete all ${pendingBulkAction.count} archived tasks. This cannot be undone.`;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archived Tasks
            </SheetTitle>
            <SheetDescription>
              Tasks that have been archived. Restore them to bring them back to
              the board or delete them permanently.
            </SheetDescription>
          </SheetHeader>

          {/* Toolbar */}
          {!loading && sorted.length > 0 && (
            <div className="flex items-center gap-3 border-b px-4 py-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
              {selectedIds.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
              )}
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="Bulk actions">
                      <Trash2 className="mr-1 h-4 w-4" />
                      Bulk Actions
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={selectedIds.size === 0}
                      onSelect={() =>
                        setPendingBulkAction({
                          type: "selected",
                          taskIds: [...selectedIds],
                        })
                      }
                    >
                      Delete Selected ({selectedIds.size})
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        setPendingBulkAction({
                          type: "all",
                          count: sorted.length,
                        })
                      }
                    >
                      Delete All
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        Delete Older Than...
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {OLDER_THAN_OPTIONS.map((days) => (
                          <DropdownMenuItem
                            key={days}
                            onSelect={() =>
                              setPendingBulkAction({
                                type: "olderThan",
                                days,
                              })
                            }
                          >
                            {days} days
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2 overflow-y-auto px-4">
            {loading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading...
              </p>
            )}
            {!loading && sorted.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No archived tasks
              </p>
            )}
            {sorted.map((task) => {
              const priority = priorityConfig[task.priority];
              return (
                <div
                  key={task._id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    checked={selectedIds.has(task._id)}
                    onCheckedChange={() => toggleTask(task._id)}
                    aria-label={`Select ${task.title}`}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {task.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={`text-xs ${priority.className}`}>
                        {priority.label}
                      </Badge>
                      {task.archivedAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(task.archivedAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRestore(task._id)}
                      aria-label={`Restore ${task.title}`}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTaskId(task._id)}
                      aria-label={`Delete ${task.title} permanently`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Single task delete confirm */}
      <ConfirmDialog
        open={!!deleteTaskId}
        onOpenChange={(o) => {
          if (!o) setDeleteTaskId(null);
        }}
        title="Delete permanently?"
        description={`"${deleteTaskTitle}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={!!pendingBulkAction}
        onOpenChange={(o) => {
          if (!o) setPendingBulkAction(null);
        }}
        title="Delete permanently?"
        description={getBulkConfirmDescription()}
        confirmLabel="Delete Permanently"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />
    </>
  );
}
