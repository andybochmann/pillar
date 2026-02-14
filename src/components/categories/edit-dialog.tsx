"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PRESET_COLORS } from "./preset-colors";
import type { Category } from "@/types";

interface EditCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  onSave: (
    id: string,
    data: { name?: string; color?: string },
  ) => Promise<unknown>;
}

export function EditCategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: EditCategoryDialogProps) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category.name);
      setColor(category.color);
    }
  }, [open, category.name, category.color]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onSave(category._id, { name: name.trim(), color });
      toast.success("Category updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update category",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-category-name">Name</Label>
            <Input
              id="edit-category-name"
              placeholder="e.g. Work, Personal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Category color"
            >
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
