"use client";

import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Ban, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBlockerOpen, wouldCreateCycle } from "@/lib/task-dependencies";
import type { Task } from "@/types";

interface TaskBlockedBySectionProps {
  taskId: string;
  blockedBy: string[];
  /** All tasks in the same project (used to resolve titles, status, and cycle checks). */
  allTasks: Task[];
  onChange: (blockedBy: string[]) => void;
}

export function TaskBlockedBySection({
  taskId,
  blockedBy,
  allTasks,
  onChange,
}: TaskBlockedBySectionProps) {
  const [open, setOpen] = useState(false);

  const tasksById = useMemo(
    () => new Map(allTasks.map((t) => [t._id, t])),
    [allTasks],
  );

  // Candidate blockers: other tasks in the project, not already a blocker, and not
  // forming a dependency cycle if added.
  const candidates = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t._id !== taskId &&
          !blockedBy.includes(t._id) &&
          !wouldCreateCycle(taskId, [...blockedBy, t._id], allTasks),
      ),
    [allTasks, taskId, blockedBy],
  );

  function handleAdd(id: string) {
    onChange([...blockedBy, id]);
    setOpen(false);
  }

  function handleRemove(id: string) {
    onChange(blockedBy.filter((b) => b !== id));
  }

  return (
    <div className="space-y-2">
      <Label>Blocked by</Label>

      {blockedBy.length > 0 ? (
        <ul className="space-y-1">
          {blockedBy.map((id) => {
            const blocker = tasksById.get(id);
            const openBlocker = blocker ? isBlockerOpen(blocker) : true;
            return (
              <li
                key={id}
                className="group flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
              >
                <Ban
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    openBlocker
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                />
                <span className="flex-1 truncate">
                  {blocker ? blocker.title : "Unknown task"}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    openBlocker
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                >
                  {openBlocker ? "Open" : "Done"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleRemove(id)}
                  aria-label={`Remove blocker ${blocker ? blocker.title : id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not blocked by any tasks.
        </p>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            aria-label="Add blocker"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add blocker
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tasks…" />
            <CommandList>
              <CommandEmpty>No tasks available.</CommandEmpty>
              <CommandGroup>
                {candidates.map((t) => (
                  <CommandItem
                    key={t._id}
                    value={t.title}
                    onSelect={() => handleAdd(t._id)}
                  >
                    <span className="truncate">{t.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
