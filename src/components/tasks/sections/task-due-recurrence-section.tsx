"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RecurrencePicker } from "@/components/tasks/recurrence-picker";
import type { Recurrence } from "@/types";

interface TaskDueRecurrenceSectionProps {
  dueDate: string;
  recurrence: Recurrence;
  onDueDateChange: (dueDate: string) => void;
  onRecurrenceChange: (recurrence: Recurrence) => void;
}

export function TaskDueRecurrenceSection({
  dueDate,
  recurrence,
  onDueDateChange,
  onRecurrenceChange,
}: TaskDueRecurrenceSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-due-date">Due Date</Label>
        <Input
          id="task-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Recurrence</Label>
        <RecurrencePicker
          value={recurrence}
          onChange={onRecurrenceChange}
        />
      </div>
    </div>
  );
}
