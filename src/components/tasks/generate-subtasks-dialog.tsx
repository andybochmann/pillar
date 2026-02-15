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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2 } from "lucide-react";
import { useGenerateSubtasks } from "@/hooks/use-generate-subtasks";

const COUNT_OPTIONS = [3, 5, 8, 10] as const;

interface GenerateSubtasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  taskDescription?: string;
  taskPriority?: string;
  existingSubtasks: string[];
  maxSubtasks: number;
  onSubtasksAdded: (titles: string[]) => void;
}

export function GenerateSubtasksDialog({
  open,
  onOpenChange,
  taskTitle,
  taskDescription,
  taskPriority,
  existingSubtasks,
  maxSubtasks,
  onSubtasksAdded,
}: GenerateSubtasksDialogProps) {
  const remainingSlots = maxSubtasks - existingSubtasks.length;
  const countOptions = COUNT_OPTIONS.filter((n) => n <= remainingSlots);
  const [count, setCount] = useState<number>(5);
  const [context, setContext] = useState("");
  const {
    drafts,
    generating,
    generateSubtasks,
    toggleDraft,
    toggleAll,
    updateDraft,
    reset,
  } = useGenerateSubtasks();

  const selectedCount = drafts.filter((d) => d.selected).length;

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      reset();
      setContext("");
    }
    onOpenChange(isOpen);
  }

  async function handleGenerate() {
    const maxCount = Math.min(count, remainingSlots);
    await generateSubtasks(
      taskTitle,
      taskDescription,
      taskPriority,
      existingSubtasks,
      maxCount,
      context.trim() || undefined,
    );
  }

  function handleAdd() {
    const selected = drafts.filter((d) => d.selected).map((d) => d.title);
    if (selected.length > 0) {
      onSubtasksAdded(selected);
      handleOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Subtasks
          </DialogTitle>
          <DialogDescription className="text-left">
            Use AI to generate subtasks for this task. Review and select which
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
                placeholder="Describe any specific requirements, constraints, or approach for breaking down this task..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Number of subtasks to generate
              </label>
              <div className="flex gap-2">
                {countOptions.map((n) => (
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
              Generate {count} Subtasks
            </Button>
          </div>
        ) : generating ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generating subtasks...
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

            <div className="max-h-[300px] overflow-y-auto pr-1">
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center gap-3 rounded-md border p-2"
                    data-testid={`draft-subtask-${draft.id}`}
                  >
                    <Checkbox
                      checked={draft.selected}
                      onCheckedChange={() => toggleDraft(draft.id)}
                      aria-label={`Select ${draft.title}`}
                    />
                    <Input
                      value={draft.title}
                      onChange={(e) => updateDraft(draft.id, { title: e.target.value })}
                      className="h-7 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
                      aria-label="Subtask title"
                    />
                  </div>
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
              disabled={selectedCount === 0}
              className="gap-2"
            >
              Add {selectedCount} Subtask{selectedCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
