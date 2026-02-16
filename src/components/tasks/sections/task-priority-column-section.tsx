"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Priority, Column } from "@/types";

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];

const priorityConfig = {
  urgent: {
    label: "Urgent",
    className: "bg-red-500 text-white hover:bg-red-600",
  },
  high: {
    label: "High",
    className: "bg-orange-500 text-white hover:bg-orange-600",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-500 text-white hover:bg-blue-600",
  },
  low: { label: "Low", className: "bg-gray-400 text-white hover:bg-gray-500" },
};

interface TaskPriorityColumnSectionProps {
  priority: Priority;
  columnId: string;
  columns: Column[];
  onPriorityChange: (priority: Priority) => void;
  onColumnChange: (columnId: string) => void;
}

export function TaskPriorityColumnSection({
  priority,
  columnId,
  columns,
  onPriorityChange,
  onColumnChange,
}: TaskPriorityColumnSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-priority">Priority</Label>
        <Select value={priority} onValueChange={onPriorityChange}>
          <SelectTrigger id="task-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                <span
                  className={cn(
                    "mr-2 inline-block h-2 w-2 rounded-full",
                    priorityConfig[p].className,
                  )}
                />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-column">Column</Label>
        <Select value={columnId} onValueChange={onColumnChange}>
          <SelectTrigger id="task-column">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
