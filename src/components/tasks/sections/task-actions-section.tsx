"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { canShareTasks, shareTask } from "@/lib/share-task";
import type { Priority } from "@/types";

interface TaskActionsSectionProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  taskPriority: Priority;
  taskDueDate?: string;
  completedAt: string | null;
  onUpdate: (data: { completedAt: string | null }) => Promise<unknown>;
  onDelete: (taskId: string) => Promise<void>;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onClose: () => void;
}

export function TaskActionsSection({
  taskId,
  taskTitle,
  taskDescription,
  taskPriority,
  taskDueDate,
  completedAt,
  onUpdate,
  onDelete,
  onDuplicate,
  onArchive,
  onClose,
}: TaskActionsSectionProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleToggleComplete() {
    try {
      const newCompletedAt = completedAt ? null : new Date().toISOString();
      await onUpdate({ completedAt: newCompletedAt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleShare() {
    try {
      await shareTask({
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        dueDate: taskDueDate,
      });
    } catch {
      toast.error("Failed to share task");
    }
  }

  async function handleDelete() {
    try {
      await onDelete(taskId);
      toast.success("Task deleted");
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  return (
    <>
      <div className="mt-auto space-y-2 pt-6">
        <Button variant="outline" className="w-full" onClick={handleToggleComplete}>
          {completedAt ? "Reopen" : "Mark Complete"}
        </Button>
        {completedAt && onArchive && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onArchive}
          >
            Archive
          </Button>
        )}
        {onDuplicate && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onDuplicate}
          >
            Duplicate
          </Button>
        )}
        {canShareTasks() && (
          <Button variant="outline" className="w-full" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        )}
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete
        </Button>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete task?"
        description={`"${taskTitle}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
