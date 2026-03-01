"use client";

import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface TaskReminderSectionProps {
  reminderAt: string;
  onReminderChange: (reminderAt: string) => void;
}

export function TaskReminderSection({
  reminderAt,
  onReminderChange,
}: TaskReminderSectionProps) {
  return (
    <div className="space-y-1.5">
      <Label>Reminder</Label>
      <DateTimePicker
        value={reminderAt}
        onChange={onReminderChange}
        clearable
      />
    </div>
  );
}
