"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { useGenerateTasks } from "@/hooks/use-generate-tasks";
import { DraftTaskItem } from "./draft-task-item";
import type { Task } from "@/types";

const COUNT_OPTIONS = [5, 8, 10, 15] as const;

interface GenerateTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onTasksAdded: (tasks: Task[]) => void;
}

export function GenerateTasksDialog({
  open,
  onOpenChange,
  projectId,
  onTasksAdded,
}: GenerateTasksDialogProps) {
  const [count, setCount] = useState<number>(8);
  const [context, setContext] = useState("");
  const {
    drafts,
    generating,
    adding,
    generateTasks,
    addSelectedTasks,
    toggleDraft,
    toggleAll,
    updateDraft,
    reset,
  } = useGenerateTasks();

  const selectedCount = drafts.filter((d) => d.selected).length;

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      reset();
      setContext("");
    }
    onOpenChange(isOpen);
  }

  async function handleGenerate() {
    await generateTasks(projectId, count, context.trim() || undefined);
  }

  async function handleAdd() {
    const tasks = await addSelectedTasks(projectId);
    if (tasks.length > 0) {
      onTasksAdded(tasks);
      handleOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Tasks
          </DialogTitle>
          <DialogDescription className="text-left">
            Use AI to generate tasks for your project. Review and select which
            ones to add.
          </DialogDescription>
        </DialogHeader>

        {drafts.length === 0 && !generating ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Additional context (optional)
              </label>
              <Textarea
                placeholder="Describe what kind of tasks you need, any specific requirements, technologies, or goals..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Number of tasks to generate
              </label>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <Button
                    key={n}
                    variant={count === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={handleGenerate} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Generate {count} Tasks
            </Button>
          </div>
        ) : generating ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generating tasks...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toggleAll(selectedCount < drafts.length)
                  }
                >
                  {selectedCount === drafts.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} of {drafts.length} selected
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Regenerate
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-1">
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <DraftTaskItem
                    key={draft.id}
                    draft={draft}
                    onToggle={toggleDraft}
                    onUpdate={updateDraft}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {drafts.length > 0 && !generating && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selectedCount === 0 || adding}
              className="gap-2"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add {selectedCount} Task{selectedCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
