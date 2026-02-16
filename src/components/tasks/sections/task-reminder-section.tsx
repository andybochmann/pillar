"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
      <Label htmlFor="task-reminder">Reminder</Label>
      <div className="flex items-center gap-2">
        <Input
          id="task-reminder"
          type="datetime-local"
          value={reminderAt}
          onChange={(e) => onReminderChange(e.target.value)}
          className="flex-1"
        />
        {reminderAt && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onReminderChange("")}
            aria-label="Clear reminder"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
