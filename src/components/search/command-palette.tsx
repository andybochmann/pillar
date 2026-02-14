"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  _id: string;
  title: string;
  projectId: string;
  priority: string;
  columnId: string;
  completedAt?: string | null;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-blue-500 text-white",
  low: "bg-gray-400 text-white",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Keyboard shortcut: / opens the palette (only when not in an input)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "/" && !isEditable) {
        e.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tasks?search=${encodeURIComponent(q.trim())}`,
      );
      if (res.ok) {
        setResults(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }

  function handleSelect(task: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/projects/${task.projectId}?taskId=${task._id}`);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setQuery("");
      setResults([]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search tasks</DialogTitle>
        <DialogDescription>
          Search for tasks across all projects
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tasks…"
            value={query}
            onValueChange={handleQueryChange}
          />
          <CommandList>
            {query.trim() && !loading && results.length === 0 && (
              <CommandEmpty>No tasks found.</CommandEmpty>
            )}
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching…
              </div>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Tasks">
                {results.map((task) => (
                  <CommandItem
                    key={task._id}
                    value={task._id}
                    onSelect={() => handleSelect(task)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span
                      className={
                        task.completedAt
                          ? "line-through text-muted-foreground"
                          : ""
                      }
                    >
                      {task.title}
                    </span>
                    <Badge className={priorityColors[task.priority] ?? ""}>
                      {task.priority}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
