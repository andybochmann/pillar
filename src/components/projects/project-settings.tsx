"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { ShareDialog } from "./share-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { ViewTypeSelector } from "@/components/shared/view-type-selector";
import { useBackButton } from "@/hooks/use-back-button";
import { useArchivedTasks } from "@/hooks/use-archived-tasks";
import type { Project, Column, Task } from "@/types";

interface ProjectSettingsProps {
  project: Project;
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: Partial<Project>) => Promise<void>;
  onDelete: () => Promise<void>;
  currentUserId?: string;
}

export function ProjectSettings({
  project,
  tasks,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  currentUserId,
}: ProjectSettingsProps) {
  useBackButton("project-settings", open, () => onOpenChange(false));

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const isOwner = project.currentUserRole === "owner";

  // Archived tasks keep their columnId, so deleting a column that only holds
  // archived tasks would strand them. Fetch archived tasks while the settings
  // sheet is open so the delete guard can account for them too.
  const { archivedTasks, fetchArchived } = useArchivedTasks();
  useEffect(() => {
    if (open) fetchArchived(project._id);
  }, [open, project._id, fetchArchived]);

  function hasTasksInColumn(columnId: string) {
    return (
      tasks.some((t) => t.columnId === columnId) ||
      archivedTasks.some((t) => t.columnId === columnId)
    );
  }

  async function handleSaveName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) {
      try {
        await onUpdate({ name: trimmed });
        toast.success("Project name updated");
      } catch (err) {
        setName(project.name);
        toast.error(
          err instanceof Error ? err.message : "Failed to update name",
        );
      }
    }
  }

  async function handleSaveDescription() {
    if (description !== (project.description ?? "")) {
      try {
        await onUpdate({ description });
        toast.success("Description updated");
      } catch (err) {
        setDescription(project.description ?? "");
        toast.error(
          err instanceof Error ? err.message : "Failed to update description",
        );
      }
    }
  }

  async function handleViewTypeChange(viewType: "board" | "list") {
    try {
      await onUpdate({ viewType });
      toast.success(`Switched to ${viewType} view`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change view type",
      );
    }
  }

  async function handleColumnsSave(columns: Column[]) {
    // Let errors propagate so ColumnManager can surface them and keep its
    // unsaved state; it shows the toast on failure.
    await onUpdate({ columns });
    toast.success("Columns updated");
  }

  async function handleArchiveToggle(archived: boolean) {
    try {
      await onUpdate({ archived });
      toast.success(archived ? "Project archived" : "Project unarchived");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update project",
      );
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>Project Settings</SheetTitle>
            <SheetDescription className="sr-only">Configure project name, columns, and settings</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 py-4">
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

            <div className="space-y-2">
              <Label>View type</Label>
              <p className="text-xs text-muted-foreground">
                Switch between Kanban board and checklist view
              </p>
              <ViewTypeSelector
                value={project.viewType ?? "board"}
                onChange={handleViewTypeChange}
              />
            </div>

            {project.viewType !== "list" && (
              <>
                <Separator />

                <ColumnManager
                  columns={project.columns}
                  onSave={handleColumnsSave}
                  hasTasksInColumn={hasTasksInColumn}
                />
              </>
            )}

            <Separator />

            {/* Sharing */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Sharing
                </Label>
                <p className="text-xs text-muted-foreground">
                  {project.memberCount && project.memberCount > 1
                    ? `${project.memberCount} members`
                    : "Only you"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareDialog(true)}
              >
                {isOwner ? "Manage" : "View"}
              </Button>
            </div>

            <Separator />

            {isOwner && (
              <>
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
              </>
            )}
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

      <ShareDialog
        projectId={project._id}
        projectName={project.name}
        currentUserRole={project.currentUserRole ?? "owner"}
        currentUserId={currentUserId}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />
    </>
  );
}
