"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EditCategoryDialog } from "./edit-dialog";
import { toast } from "sonner";
import type { Category } from "@/types";

interface CategoryActionsProps {
  category: Category;
  onAddProject: (categoryId: string) => void;
  onUpdate: (
    id: string,
    data: { name?: string; color?: string },
  ) => Promise<Category>;
  onDelete: (id: string) => Promise<void>;
}

export function CategoryActions({
  category,
  onAddProject,
  onUpdate,
  onDelete,
}: CategoryActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDelete() {
    try {
      await onDelete(category._id);
      toast.success("Category deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete category",
      );
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 hover:opacity-100"
            aria-label={`Actions for ${category.name}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onAddProject(category._id)}>
            <Plus className="h-4 w-4" />
            Add Project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCategoryDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        category={category}
        onSave={onUpdate}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Category"
        description={`This will permanently delete "${category.name}" and all projects and tasks within it. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
