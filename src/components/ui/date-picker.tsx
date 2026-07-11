"use client";

import { format, addDays } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  clearable?: boolean;
}

function parseDateString(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Quick-select chips resolve to a local calendar date, matching how the
// calendar itself emits values (yyyy-MM-dd, no timezone shift).
const QUICK_OPTIONS: { label: string; getDate: () => Date }[] = [
  { label: "Today", getDate: () => new Date() },
  { label: "Tomorrow", getDate: () => addDays(new Date(), 1) },
  { label: "Next week", getDate: () => addDays(new Date(), 7) },
];

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  ariaLabel,
  clearable = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateString(value);

  function selectDate(date: Date) {
    onChange(formatDateString(date));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            aria-label={ariaLabel}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, "MMM d, yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        {clearable && value && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            onClick={() => onChange("")}
            aria-label="Clear date"
          >
            <X />
          </Button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-wrap gap-1 border-b p-2">
          {QUICK_OPTIONS.map((option) => {
            const date = option.getDate();
            const optionValue = formatDateString(date);
            return (
              <Button
                key={option.label}
                type="button"
                variant={value === optionValue ? "default" : "secondary"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => selectDate(date)}
              >
                {option.label}
              </Button>
            );
          })}
          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              onChange(formatDateString(day));
              setOpen(false);
            } else if (clearable) {
              // Clicking the already-selected day deselects it (day is
              // undefined). When clearable, treat that as clearing the value.
              onChange("");
              setOpen(false);
            }
            // Otherwise keep the popover open so a deselect isn't a silent no-op.
          }}
          defaultMonth={selected}
        />
      </PopoverContent>
    </Popover>
  );
}
