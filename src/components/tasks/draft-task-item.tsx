"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks } from "lucide-react";
import type { TaskDraft, Column, Priority } from "@/types";

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "text-red-600",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
};

interface DraftTaskItemProps {
  draft: TaskDraft;
  columns: Column[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, data: Partial<TaskDraft>) => void;
}

export function DraftTaskItem({
  draft,
  columns,
  onToggle,
  onUpdate,
}: DraftTaskItemProps) {
  const column = columns.find((c) => c.id === draft.columnId);

  return (
    <div
      className="flex items-start gap-3 rounded-md border p-3"
      data-testid={`draft-item-${draft.id}`}
    >
      <Checkbox
        checked={draft.selected}
        onCheckedChange={() => onToggle(draft.id)}
        aria-label={`Select ${draft.title}`}
        className="mt-1"
      />

      <div className="flex-1 space-y-1.5">
        <Input
          value={draft.title}
          onChange={(e) => onUpdate(draft.id, { title: e.target.value })}
          className="h-7 border-0 px-0 text-sm font-medium shadow-none focus-visible:ring-0"
          aria-label="Task title"
        />

        {draft.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {draft.description}
          </p>
        )}

        {draft.subtasks.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ListChecks className="h-3 w-3" />
            <span>
              {draft.subtasks.length} subtask
              {draft.subtasks.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={draft.priority}
          onValueChange={(value) =>
            onUpdate(draft.id, { priority: value as Priority })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-24 text-xs"
            aria-label="Priority"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["urgent", "high", "medium", "low"] as Priority[]).map((p) => (
              <SelectItem key={p} value={p}>
                <span className={PRIORITY_COLORS[p]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-xs whitespace-nowrap">
          {column?.name ?? draft.columnId}
        </Badge>
      </div>
    </div>
  );
}
