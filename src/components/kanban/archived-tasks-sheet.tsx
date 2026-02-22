"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useArchivedTasks } from "@/hooks/use-archived-tasks";
import { toast } from "sonner";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Priority } from "@/types";

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-500 text-white" },
  high: { label: "High", className: "bg-orange-500 text-white" },
  medium: { label: "Medium", className: "bg-blue-500 text-white" },
  low: { label: "Low", className: "bg-gray-400 text-white" },
};

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
  } = useArchivedTasks();
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const deleteTaskTitle =
    archivedTasks.find((t) => t._id === deleteTaskId)?.title ?? "";

  useEffect(() => {
    if (open) {
      fetchArchived(projectId);
    }
  }, [open, projectId, fetchArchived]);

  async function handleRestore(taskId: string) {
    try {
      await unarchiveTask(taskId);
      toast.success("Task restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore task");
    }
  }

  async function handleDelete() {
    if (!deleteTaskId) return;
    try {
      await permanentDeleteTask(deleteTaskId);
      toast.success("Task permanently deleted");
      setDeleteTaskId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  const sorted = useMemo(
    () =>
      [...archivedTasks].sort((a, b) => {
        const aDate = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
        const bDate = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
        return bDate - aDate;
      }),
    [archivedTasks],
  );

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

          <div className="mt-4 space-y-2 overflow-y-auto">
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

      <ConfirmDialog
        open={!!deleteTaskId}
        onOpenChange={(open) => {
          if (!open) setDeleteTaskId(null);
        }}
        title="Delete permanently?"
        description={`"${deleteTaskTitle}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
