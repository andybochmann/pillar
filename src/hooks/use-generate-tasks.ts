"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { toast } from "sonner";
import type { Task, TaskDraft } from "@/types";

interface UseGenerateTasksReturn {
  drafts: TaskDraft[];
  generating: boolean;
  adding: boolean;
  generateTasks: (projectId: string, maxCount?: number) => Promise<void>;
  addSelectedTasks: (projectId: string) => Promise<Task[]>;
  toggleDraft: (id: string) => void;
  toggleAll: (selected: boolean) => void;
  updateDraft: (id: string, data: Partial<TaskDraft>) => void;
  reset: () => void;
}

export function useGenerateTasks(): UseGenerateTasksReturn {
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);

  const generateTasks = useCallback(
    async (projectId: string, maxCount?: number) => {
      try {
        setGenerating(true);
        const body: Record<string, unknown> = { projectId };
        if (maxCount) body.maxCount = maxCount;

        const res = await fetch("/api/ai/generate-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to generate tasks");
        }

        const data = await res.json();
        const taskDrafts: TaskDraft[] = data.tasks.map((task: Omit<TaskDraft, "id" | "selected">, index: number) => ({
          id: `draft-${Date.now()}-${index}`,
          ...task,
          subtasks: task.subtasks ?? [],
          selected: true,
        }));

        setDrafts(taskDrafts);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  const addSelectedTasks = useCallback(
    async (projectId: string): Promise<Task[]> => {
      const selected = drafts.filter((d) => d.selected);
      if (selected.length === 0) return [];

      try {
        setAdding(true);
        const res = await offlineFetch("/api/tasks/bulk-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            tasks: selected.map((d) => ({
              title: d.title,
              description: d.description,
              columnId: d.columnId,
              priority: d.priority,
              subtasks: d.subtasks.map((s) => ({ title: s })),
            })),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to add tasks");
        }

        const data = await res.json();
        toast.success(`Added ${data.tasks.length} tasks`);
        setDrafts([]);
        return data.tasks;
      } catch (err) {
        toast.error((err as Error).message);
        return [];
      } finally {
        setAdding(false);
      }
    },
    [drafts],
  );

  const toggleDraft = useCallback((id: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
    );
  }, []);

  const toggleAll = useCallback((selected: boolean) => {
    setDrafts((prev) => prev.map((d) => ({ ...d, selected })));
  }, []);

  const updateDraft = useCallback((id: string, data: Partial<TaskDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...data } : d)),
    );
  }, []);

  const reset = useCallback(() => {
    setDrafts([]);
  }, []);

  return {
    drafts,
    generating,
    adding,
    generateTasks,
    addSelectedTasks,
    toggleDraft,
    toggleAll,
    updateDraft,
    reset,
  };
}
