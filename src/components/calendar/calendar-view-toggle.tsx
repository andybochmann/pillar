"use client";

import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import type { CalendarViewType } from "@/types";

interface CalendarViewToggleProps {
  viewType: CalendarViewType;
  onChange: (viewType: CalendarViewType) => void;
}

const VIEW_OPTIONS = [
  { value: "month" as const, label: "Month", icon: Calendar },
  { value: "week" as const, label: "Week", icon: CalendarRange },
  { value: "day" as const, label: "Day", icon: CalendarDays },
];

export function CalendarViewToggle({
  viewType,
  onChange,
}: CalendarViewToggleProps) {
  return (
    <div className="flex items-center gap-1" data-testid="calendar-view-toggle">
      {VIEW_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = viewType === option.value;

        return (
          <Button
            key={option.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            aria-label={`Switch to ${option.label} view`}
          >
            <Icon className="mr-1 h-4 w-4" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
