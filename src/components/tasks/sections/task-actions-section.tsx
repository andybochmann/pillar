"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";

interface TaskActionsSectionProps {
  taskId: string;
  taskTitle: string;
  completedAt: string | null;
  onUpdate: (data: { completedAt: string | null }) => Promise<unknown>;
  onDelete: (taskId: string) => Promise<void>;
  onDuplicate?: () => void;
  onClose: () => void;
}

export function TaskActionsSection({
  taskId,
  taskTitle,
  completedAt,
  onUpdate,
  onDelete,
  onDuplicate,
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
        {completedAt ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleToggleComplete}
          >
            Reopen
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleToggleComplete}
          >
            Mark Complete
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
