"use client";

import { format } from "date-fns";
import { CalendarIcon, Clock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
}

function parseDateTimeString(value: string): {
  date: Date | undefined;
  time: string;
} {
  if (!value) return { date: undefined, time: "" };
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return {
    date: new Date(year, month - 1, day),
    time: timePart || "",
  };
}

function formatDatePart(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  clearable = false,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const { date: selectedDate, time: selectedTime } =
    parseDateTimeString(value);

  function handleDateSelect(day: Date | undefined) {
    if (!day) return;
    const time = selectedTime || currentTime();
    onChange(`${formatDatePart(day)}T${time}`);
  }

  function handleTimeChange(newTime: string) {
    if (!selectedDate) return;
    onChange(`${formatDatePart(selectedDate)}T${newTime}`);
  }

  const displayText = selectedDate
    ? format(
        selectedDate,
        selectedTime ? "MMM d, yyyy" : "MMM d, yyyy",
      ) + (selectedTime ? ` at ${formatTimeDisplay(selectedTime)}` : "")
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayText || placeholder}
          </Button>
        </PopoverTrigger>
        {clearable && value && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            onClick={() => onChange("")}
            aria-label="Clear date and time"
          >
            <X />
          </Button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          defaultMonth={selectedDate}
        />
        <div className="border-t p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Input
            type="time"
            value={selectedTime}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-auto"
            aria-label="Time"
            disabled={!selectedDate}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}
