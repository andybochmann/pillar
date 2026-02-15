"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Label, Priority, Project } from "@/types";

export interface CalendarFilters {
  projects: string[];
  labels: string[];
  priorities: Priority[];
  assignees: string[];
}

export const EMPTY_FILTERS: CalendarFilters = {
  projects: [],
  labels: [],
  priorities: [],
  assignees: [],
};

const PRIORITIES = [
  { value: "urgent" as const, label: "Urgent" },
  { value: "high" as const, label: "High" },
  { value: "medium" as const, label: "Medium" },
  { value: "low" as const, label: "Low" },
];

export interface Assignee {
  _id: string;
  name: string;
  email: string;
}

interface CalendarFilterBarProps {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  projects: Project[];
  labels: Label[];
  assignees: Assignee[];
}

export function CalendarFilterBar({
  filters,
  onChange,
  projects,
  labels,
  assignees,
}: CalendarFilterBarProps) {
  const activeCount =
    filters.projects.length +
    filters.labels.length +
    filters.priorities.length +
    filters.assignees.length;

  function toggleProject(projectId: string) {
    const next = filters.projects.includes(projectId)
      ? filters.projects.filter((x) => x !== projectId)
      : [...filters.projects, projectId];
    onChange({ ...filters, projects: next });
  }

  function toggleLabel(labelId: string) {
    const next = filters.labels.includes(labelId)
      ? filters.labels.filter((x) => x !== labelId)
      : [...filters.labels, labelId];
    onChange({ ...filters, labels: next });
  }

  function togglePriority(p: Priority) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onChange({ ...filters, priorities: next });
  }

  function toggleAssignee(assigneeId: string) {
    const next = filters.assignees.includes(assigneeId)
      ? filters.assignees.filter((x) => x !== assigneeId)
      : [...filters.assignees, assigneeId];
    onChange({ ...filters, assignees: next });
  }

  function clearAll() {
    onChange(EMPTY_FILTERS);
  }

  return (
    <div className="flex items-center gap-2" data-testid="calendar-filter-bar">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-4" align="start">
          {/* Project filters */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project
            </p>
            <div className="flex flex-wrap gap-1">
              {projects.map((p) => (
                <Button
                  key={p._id}
                  variant={
                    filters.projects.includes(p._id) ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => toggleProject(p._id)}
                  aria-pressed={filters.projects.includes(p._id)}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

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
          {labels.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Labels
              </p>
              <div className="flex flex-wrap gap-1">
                {labels.map((l) => (
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

          {/* Assignee filters */}
          {assignees.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assignee
              </p>
              <div className="flex flex-wrap gap-1">
                {assignees.map((a) => (
                  <Button
                    key={a._id}
                    variant={
                      filters.assignees.includes(a._id) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleAssignee(a._id)}
                    aria-pressed={filters.assignees.includes(a._id)}
                  >
                    {a.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
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
