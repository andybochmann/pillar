"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ColumnManager } from "./column-manager";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import type { Project, Column, Task } from "@/types";

interface ProjectSettingsProps {
  project: Project;
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: Partial<Project>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ProjectSettings({
  project,
  tasks,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: ProjectSettingsProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function hasTasksInColumn(columnId: string) {
    return tasks.some((t) => t.columnId === columnId);
  }

  async function handleSaveName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) {
      await onUpdate({ name: trimmed });
      toast.success("Project name updated");
    }
  }

  async function handleSaveDescription() {
    if (description !== (project.description ?? "")) {
      await onUpdate({ description });
      toast.success("Description updated");
    }
  }

  async function handleColumnsSave(columns: Column[]) {
    await onUpdate({ columns });
    toast.success("Columns updated");
  }

  async function handleArchiveToggle(archived: boolean) {
    await onUpdate({ archived });
    toast.success(archived ? "Project archived" : "Project unarchived");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Project Settings</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSaveDescription}
                rows={3}
              />
            </div>

            <Separator />

            <ColumnManager
              columns={project.columns}
              onSave={handleColumnsSave}
              hasTasksInColumn={hasTasksInColumn}
            />

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Archive project</Label>
                <p className="text-xs text-muted-foreground">
                  Hidden from sidebar when archived
                </p>
              </div>
              <Switch
                aria-label="Archive project"
                checked={project.archived}
                onCheckedChange={handleArchiveToggle}
              />
            </div>

            <Separator />

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete project
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete project?"
        description="This will permanently delete this project and all its tasks. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onDelete}
      />
    </>
  );
}
