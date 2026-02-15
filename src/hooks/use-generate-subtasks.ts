"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { SubtaskDraft } from "@/types";

interface UseGenerateSubtasksReturn {
  drafts: SubtaskDraft[];
  generating: boolean;
  generateSubtasks: (
    title: string,
    description?: string,
    priority?: string,
    existingSubtasks?: string[],
    maxCount?: number,
    context?: string,
  ) => Promise<void>;
  toggleDraft: (id: string) => void;
  toggleAll: (selected: boolean) => void;
  updateDraft: (id: string, data: Partial<SubtaskDraft>) => void;
  reset: () => void;
}

export function useGenerateSubtasks(): UseGenerateSubtasksReturn {
  const [drafts, setDrafts] = useState<SubtaskDraft[]>([]);
  const [generating, setGenerating] = useState(false);

  const generateSubtasks = useCallback(
    async (
      title: string,
      description?: string,
      priority?: string,
      existingSubtasks?: string[],
      maxCount?: number,
      context?: string,
    ) => {
      try {
        setGenerating(true);
        const body: Record<string, unknown> = { title };
        if (description) body.description = description;
        if (priority) body.priority = priority;
        if (existingSubtasks?.length) body.existingSubtasks = existingSubtasks;
        if (maxCount) body.maxCount = maxCount;
        if (context) body.context = context;

        const res = await fetch("/api/ai/generate-subtasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to generate subtasks");
        }

        const data = await res.json();
        const subtaskDrafts: SubtaskDraft[] = data.subtasks.map(
          (title: string, index: number) => ({
            id: `draft-${Date.now()}-${index}`,
            title,
            selected: true,
          }),
        );

        setDrafts(subtaskDrafts);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  const toggleDraft = useCallback((id: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
    );
  }, []);

  const toggleAll = useCallback((selected: boolean) => {
    setDrafts((prev) => prev.map((d) => ({ ...d, selected })));
  }, []);

  const updateDraft = useCallback((id: string, data: Partial<SubtaskDraft>) => {
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
    generateSubtasks,
    toggleDraft,
    toggleAll,
    updateDraft,
    reset,
  };
}
