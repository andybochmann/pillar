"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Label, Priority } from "@/types";

export interface BoardFilters {
  priorities: Priority[];
  labels: string[];
  dueDateRange: "overdue" | "today" | "week" | null;
}

export const EMPTY_FILTERS: BoardFilters = {
  priorities: [],
  labels: [],
  dueDateRange: null,
};

const PRIORITIES = [
  { value: "urgent" as const, label: "Urgent" },
  { value: "high" as const, label: "High" },
  { value: "medium" as const, label: "Medium" },
  { value: "low" as const, label: "Low" },
];

const DUE_DATE_OPTIONS = [
  { value: "overdue" as const, label: "Overdue" },
  { value: "today" as const, label: "Due today" },
  { value: "week" as const, label: "Due this week" },
];

interface BoardFilterBarProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  allLabels: Label[];
}

export function BoardFilterBar({
  filters,
  onChange,
  allLabels,
}: BoardFilterBarProps) {
  const activeCount =
    filters.priorities.length +
    filters.labels.length +
    (filters.dueDateRange ? 1 : 0);

  function togglePriority(p: Priority) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onChange({ ...filters, priorities: next });
  }

  function toggleLabel(name: string) {
    const next = filters.labels.includes(name)
      ? filters.labels.filter((x) => x !== name)
      : [...filters.labels, name];
    onChange({ ...filters, labels: next });
  }

  function setDueDateRange(value: BoardFilters["dueDateRange"]) {
    onChange({
      ...filters,
      dueDateRange: filters.dueDateRange === value ? null : value,
    });
  }

  function clearAll() {
    onChange(EMPTY_FILTERS);
  }

  return (
    <div className="flex items-center gap-2" data-testid="board-filter-bar">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-4" align="start">
          {/* Priority filters */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Priority
            </p>
            <div className="flex flex-wrap gap-1">
              {PRIORITIES.map((p) => (
                <Button
                  key={p.value}
                  variant={
                    filters.priorities.includes(p.value) ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => togglePriority(p.value)}
                  aria-pressed={filters.priorities.includes(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Label filters */}
          {allLabels.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Labels
              </p>
              <div className="flex flex-wrap gap-1">
                {allLabels.map((l) => (
                  <Button
                    key={l._id}
                    variant={
                      filters.labels.includes(l._id) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleLabel(l._id)}
                    aria-pressed={filters.labels.includes(l._id)}
                  >
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Due date filters */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Due date
            </p>
            <div className="flex flex-wrap gap-1">
              {DUE_DATE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={
                    filters.dueDateRange === opt.value ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setDueDateRange(opt.value)}
                  aria-pressed={filters.dueDateRange === opt.value}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
