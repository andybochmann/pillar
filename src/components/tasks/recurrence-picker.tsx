"use client";

import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import type { Recurrence, RecurrenceFrequency } from "@/types";

const FREQUENCIES: RecurrenceFrequency[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

interface RecurrencePickerProps {
  value: Recurrence;
  onChange: (recurrence: Recurrence) => void;
}

function getPreviewText(recurrence: Recurrence): string | null {
  if (recurrence.frequency === "none") return null;

  const unitMap: Record<string, [string, string]> = {
    daily: ["day", "days"],
    weekly: ["week", "weeks"],
    monthly: ["month", "months"],
    yearly: ["year", "years"],
  };

  const [singular, plural] = unitMap[recurrence.frequency] ?? ["", ""];
  const unit = recurrence.interval === 1 ? singular : plural;
  const intervalText =
    recurrence.interval === 1 ? "" : `${recurrence.interval} `;

  let text = `Repeats every ${intervalText}${unit}`;

  if (recurrence.endDate) {
    // Parse the date portion directly to avoid timezone shifts
    const datePart = recurrence.endDate.slice(0, 10);
    const [year, month, day] = datePart.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    text += ` until ${format(d, "MMM d, yyyy")}`;
  }

  return text;
}

export function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  const preview = getPreviewText(value);

  function handleFrequencyChange(frequency: RecurrenceFrequency) {
    onChange({ ...value, frequency });
  }

  function handleIntervalChange(raw: number) {
    const interval = Math.max(1, raw);
    onChange({ ...value, interval });
  }

  function handleEndDateChange(dateStr: string) {
    onChange({
      ...value,
      endDate: dateStr
        ? new Date(dateStr + "T00:00:00Z").toISOString()
        : undefined,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={value.frequency} onValueChange={handleFrequencyChange}>
          <SelectTrigger className="flex-1" aria-label="Recurrence frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.frequency !== "none" && (
          <Input
            type="number"
            min={1}
            value={value.interval}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            className="w-20"
            aria-label="Recurrence interval"
          />
        )}
      </div>
      {value.frequency !== "none" && (
        <DatePicker
          value={value.endDate ? value.endDate.slice(0, 10) : ""}
          onChange={handleEndDateChange}
          ariaLabel="Recurrence end date"
          placeholder="End date (optional)"
          clearable
        />
      )}
      {preview && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="recurrence-preview"
        >
          {preview}
        </p>
      )}
    </div>
  );
}

export { getPreviewText };
