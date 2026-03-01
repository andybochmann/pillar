"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  CheckCircle2,
  RotateCcw,
  MoreHorizontal,
  Archive,
  Copy,
  Share2,
  Trash2,
} from "lucide-react";
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
      if (completedAt) {
        await onUpdate({ completedAt: null });
      } else {
        const newCompletedAt = new Date().toISOString();
        await onUpdate({ completedAt: newCompletedAt });
        toast.success("Task completed", {
          action: { label: "Undo", onClick: () => onUpdate({ completedAt: null }) },
        });
        onClose();
      }
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
      <div className="border-t bg-background px-6 py-3 flex items-center gap-2">
        <Button className="flex-1" onClick={handleToggleComplete}>
          {completedAt ? (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark Complete
            </>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {completedAt && onArchive && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            )}
            {onDuplicate && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            )}
            {canShareTasks() && (
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
            )}
            {((completedAt && onArchive) || onDuplicate || canShareTasks()) && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
