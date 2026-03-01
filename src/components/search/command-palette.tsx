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
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useBackButton } from "@/hooks/use-back-button";
import {
  SearchX,
  Loader2,
  Clock,
  FileText,
  Archive,
  CheckSquare,
} from "lucide-react";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
} from "@/lib/recent-searches";

interface TaskResult {
  _id: string;
  title: string;
  projectId: string;
  projectName: string;
  priority: string;
  columnId: string;
  completedAt?: string | null;
  archived?: boolean;
}

interface NoteResult {
  _id: string;
  title: string;
  parentType: string;
  parentName: string;
  snippet: string;
  projectId?: string;
  categoryId?: string;
  taskId?: string;
}

interface SearchResults {
  tasks: TaskResult[];
  notes: NoteResult[];
  archivedTasks: TaskResult[];
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
  const [results, setResults] = useState<SearchResults>({
    tasks: [],
    notes: [],
    archivedTasks: [],
  });
  const [loading, setLoading] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useBackButton("command-palette", open, () => setOpen(false));

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Load recent searches when palette opens
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

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

  const search = useCallback(
    async (q: string, archived: boolean) => {
      if (!q.trim()) {
        setResults({ tasks: [], notes: [], archivedTasks: [] });
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: q.trim() });
        if (archived) params.set("includeArchived", "true");
        const res = await fetch(`/api/search?${params.toString()}`);
        if (res.ok) {
          const data: SearchResults = await res.json();
          setResults(data);
          addRecentSearch(q.trim());
          setRecentSearches(getRecentSearches());
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => search(value, includeArchived),
      300,
    );
  }

  function handleArchivedToggle(checked: boolean) {
    setIncludeArchived(checked);
    if (query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(query, checked), 300);
    }
  }

  function handleSelectTask(task: TaskResult) {
    setOpen(false);
    setQuery("");
    setResults({ tasks: [], notes: [], archivedTasks: [] });
    router.push(`/projects/${task.projectId}?taskId=${task._id}`);
  }

  function handleSelectNote(note: NoteResult) {
    setOpen(false);
    setQuery("");
    setResults({ tasks: [], notes: [], archivedTasks: [] });
    if (note.parentType === "task" && note.projectId && note.taskId) {
      router.push(`/projects/${note.projectId}?taskId=${note.taskId}`);
    } else if (note.parentType === "project" && note.projectId) {
      router.push(`/projects/${note.projectId}`);
    } else if (note.parentType === "category" && note.categoryId) {
      router.push(`/categories/${note.categoryId}/notes`);
    }
  }

  function handleSelectRecent(q: string) {
    setQuery(q);
    search(q, includeArchived);
  }

  function handleClearRecent() {
    clearRecentSearches();
    setRecentSearches([]);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setQuery("");
      setResults({ tasks: [], notes: [], archivedTasks: [] });
    }
  }

  const hasQuery = query.trim().length > 0;
  const hasResults =
    results.tasks.length > 0 ||
    results.notes.length > 0 ||
    results.archivedTasks.length > 0;
  const showRecent = !hasQuery && !loading && recentSearches.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            Search for tasks and notes across all projects
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tasks and notes..."
            value={query}
            onValueChange={handleQueryChange}
          />
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Switch
              id="include-archived"
              checked={includeArchived}
              onCheckedChange={handleArchivedToggle}
              className="scale-75"
            />
            <label
              htmlFor="include-archived"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Include archived
            </label>
          </div>
          <CommandList>
            {hasQuery && !loading && !hasResults && (
              <CommandEmpty>
                <div className="flex flex-col items-center justify-center py-12">
                  <SearchX className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No results found
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try a different search term
                  </p>
                </div>
              </CommandEmpty>
            )}
            {loading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Searching...</p>
              </div>
            )}

            {/* Recent searches */}
            {showRecent && (
              <CommandGroup
                heading={
                  <span className="flex items-center justify-between w-full">
                    <span>Recent Searches</span>
                    <button
                      onClick={handleClearRecent}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  </span>
                }
              >
                {recentSearches.map((q) => (
                  <CommandItem
                    key={q}
                    value={`recent-${q}`}
                    onSelect={() => handleSelectRecent(q)}
                    className="flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{q}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Tasks */}
            {results.tasks.length > 0 && (
              <CommandGroup
                heading={`Tasks (${results.tasks.length})`}
              >
                {results.tasks.map((task) => (
                  <CommandItem
                    key={`task-${task._id}`}
                    value={`task-${task._id}`}
                    onSelect={() => handleSelectTask(task)}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span
                          className={
                            task.completedAt
                              ? "line-through text-muted-foreground"
                              : ""
                          }
                        >
                          {task.title}
                        </span>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.projectName}
                        </p>
                      </div>
                    </div>
                    <Badge className={priorityColors[task.priority] ?? ""}>
                      {task.priority}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Notes */}
            {results.notes.length > 0 && (
              <>
                {results.tasks.length > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={`Notes (${results.notes.length})`}
                >
                  {results.notes.map((note) => (
                    <CommandItem
                      key={`note-${note._id}`}
                      value={`note-${note._id}`}
                      onSelect={() => handleSelectNote(note)}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span>{note.title}</span>
                        <p className="text-xs text-muted-foreground truncate">
                          {note.parentName}
                          {note.snippet && ` — ${note.snippet}`}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Archived Tasks */}
            {results.archivedTasks.length > 0 && (
              <>
                {(results.tasks.length > 0 || results.notes.length > 0) && (
                  <CommandSeparator />
                )}
                <CommandGroup
                  heading={`Archived Tasks (${results.archivedTasks.length})`}
                >
                  {results.archivedTasks.map((task) => (
                    <CommandItem
                      key={`archived-${task._id}`}
                      value={`archived-${task._id}`}
                      onSelect={() => handleSelectTask(task)}
                      className="flex items-center justify-between gap-2 opacity-70"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Archive className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <span className="text-muted-foreground">
                            {task.title}
                          </span>
                          <p className="text-xs text-muted-foreground truncate">
                            {task.projectName}
                          </p>
                        </div>
                      </div>
                      <Badge className={priorityColors[task.priority] ?? ""}>
                        {task.priority}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
