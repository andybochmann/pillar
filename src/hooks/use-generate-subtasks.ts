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

/**
 * Manages AI-powered subtask generation using Claude API for task breakdown.
 *
 * This hook provides an interface for generating intelligent subtask suggestions based on
 * a parent task's title, description, and priority. It returns editable drafts that can be
 * toggled, modified, and selectively added to a task. Uses the `/api/ai/generate-subtasks`
 * endpoint powered by Claude to analyze task context and suggest actionable subtasks.
 *
 * @returns {UseGenerateSubtasksReturn} Object containing:
 *   - `drafts`: Array of generated subtask drafts with id, title, and selection state
 *   - `generating`: Boolean indicating if AI generation is in progress
 *   - `generateSubtasks`: Function to call Claude API and populate drafts
 *   - `toggleDraft`: Function to toggle selection state of a single draft
 *   - `toggleAll`: Function to select or deselect all drafts at once
 *   - `updateDraft`: Function to edit draft properties (e.g., title)
 *   - `reset`: Function to clear all drafts
 *
 * @example
 * ```tsx
 * function GenerateSubtasksDialog({ task }: { task: Task }) {
 *   const {
 *     drafts,
 *     generating,
 *     generateSubtasks,
 *     toggleDraft,
 *     updateDraft,
 *     reset
 *   } = useGenerateSubtasks();
 *
 *   const handleGenerate = async () => {
 *     await generateSubtasks(
 *       task.title,
 *       task.description,
 *       task.priority,
 *       task.subtasks.map(s => s.title), // Avoid duplicates
 *       5, // Max 5 subtasks
 *       "Focus on technical implementation steps"
 *     );
 *   };
 *
 *   const handleAdd = () => {
 *     const selected = drafts.filter(d => d.selected);
 *     updateTask(task._id, {
 *       subtasks: [...task.subtasks, ...selected.map(d => ({ title: d.title, completed: false }))]
 *     });
 *     reset();
 *   };
 *
 *   return (
 *     <Dialog>
 *       <Button onClick={handleGenerate} disabled={generating}>
 *         {generating ? "Generating..." : "Generate Subtasks"}
 *       </Button>
 *       {drafts.map((draft) => (
 *         <div key={draft.id}>
 *           <Checkbox checked={draft.selected} onCheckedChange={() => toggleDraft(draft.id)} />
 *           <Input
 *             value={draft.title}
 *             onChange={(e) => updateDraft(draft.id, { title: e.target.value })}
 *           />
 *         </div>
 *       ))}
 *       <Button onClick={handleAdd} disabled={drafts.filter(d => d.selected).length === 0}>
 *         Add Selected
 *       </Button>
 *     </Dialog>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Calls `/api/ai/generate-subtasks` endpoint which uses Claude API (incurs AI usage costs)
 * - Displays error toast on generation failure via `toast.error()`
 * - Generates unique draft IDs using timestamp to avoid collisions
 * - All drafts are selected by default after generation
 *
 * **Implementation Details:**
 * - Uses plain `fetch()` (not `offlineFetch`) since AI generation requires network connectivity
 * - Error handling displays user-friendly messages via Sonner toast
 * - Optional parameters (description, priority, maxCount, context) are conditionally included in request body
 * - `existingSubtasks` parameter helps Claude avoid suggesting duplicates
 * - Draft IDs use format `draft-${timestamp}-${index}` for uniqueness
 */
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
