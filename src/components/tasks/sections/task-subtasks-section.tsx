"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Sparkles } from "lucide-react";
import type { Subtask } from "@/types";

interface TaskSubtasksSectionProps {
  subtasks: Subtask[];
  onToggleSubtask: (id: string) => void;
  onDeleteSubtask: (id: string) => void;
  newSubtaskTitle: string;
  onNewSubtaskTitleChange: (value: string) => void;
  onAddSubtask: () => void;
  onSubtaskKeyDown: (e: React.KeyboardEvent) => void;
  aiEnabled?: boolean;
  onGenerateClick?: () => void;
  maxSubtasks?: number;
}

export function TaskSubtasksSection({
  subtasks,
  onToggleSubtask,
  onDeleteSubtask,
  newSubtaskTitle,
  onNewSubtaskTitleChange,
  onAddSubtask,
  onSubtaskKeyDown,
  aiEnabled = false,
  onGenerateClick,
  maxSubtasks = 50,
}: TaskSubtasksSectionProps) {
  const completedCount = subtasks.filter((s) => s.completed).length;

  return (
    <div className="space-y-2">
      <Label>Subtasks</Label>
      {subtasks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {completedCount} of {subtasks.length} completed
        </p>
      )}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask._id}
            className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted"
          >
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={() => onToggleSubtask(subtask._id)}
              aria-label={`Toggle ${subtask.title}`}
            />
            <span
              className={
                subtask.completed
                  ? "flex-1 text-sm line-through text-muted-foreground"
                  : "flex-1 text-sm"
              }
            >
              {subtask.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onDeleteSubtask(subtask._id)}
              aria-label={`Delete ${subtask.title}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      {aiEnabled && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onGenerateClick}
          disabled={subtasks.length >= maxSubtasks}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate subtasks
        </Button>
      )}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add a subtask…"
          value={newSubtaskTitle}
          onChange={(e) => onNewSubtaskTitleChange(e.target.value)}
          onKeyDown={onSubtaskKeyDown}
          aria-label="New subtask title"
          className="h-8 text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onAddSubtask}
          disabled={!newSubtaskTitle.trim()}
          aria-label="Add subtask"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
