"use client";

import { format } from "date-fns";
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
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              onChange(formatDateString(day));
            }
            setOpen(false);
          }}
          defaultMonth={selected}
        />
      </PopoverContent>
    </Popover>
  );
}
