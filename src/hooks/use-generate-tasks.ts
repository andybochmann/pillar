"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Task, TaskDraft } from "@/types";

interface UseGenerateTasksReturn {
  drafts: TaskDraft[];
  generating: boolean;
  adding: boolean;
  generateTasks: (projectId: string, maxCount?: number, context?: string) => Promise<void>;
  addSelectedTasks: (projectId: string) => Promise<Task[]>;
  toggleDraft: (id: string) => void;
  toggleAll: (selected: boolean) => void;
  updateDraft: (id: string, data: Partial<TaskDraft>) => void;
  reset: () => void;
}

/**
 * Manages AI-powered task generation using Claude API for project planning and task creation.
 *
 * This hook provides a complete workflow for generating intelligent task suggestions based on
 * project context, then bulk-creating selected tasks. It uses Claude API to analyze the project
 * and generate contextually relevant tasks with titles, descriptions, priorities, and subtasks.
 * Supports draft editing before creation and dispatches real-time sync events after bulk creation.
 *
 * @returns {UseGenerateTasksReturn} Object containing:
 *   - `drafts`: Array of generated task drafts with full task properties (title, description, priority, subtasks, etc.)
 *   - `generating`: Boolean indicating if AI generation is in progress
 *   - `adding`: Boolean indicating if bulk task creation is in progress
 *   - `generateTasks`: Function to call Claude API and populate drafts based on project context
 *   - `addSelectedTasks`: Function to bulk-create selected drafts and notify other instances via custom event
 *   - `toggleDraft`: Function to toggle selection state of a single draft
 *   - `toggleAll`: Function to select or deselect all drafts at once
 *   - `updateDraft`: Function to edit draft properties (title, description, priority, columnId, subtasks)
 *   - `reset`: Function to clear all drafts
 *
 * @example
 * ```tsx
 * function GenerateTasksDialog({ project }: { project: Project }) {
 *   const {
 *     drafts,
 *     generating,
 *     adding,
 *     generateTasks,
 *     addSelectedTasks,
 *     toggleDraft,
 *     updateDraft,
 *     reset
 *   } = useGenerateTasks();
 *
 *   const handleGenerate = async () => {
 *     await generateTasks(
 *       project._id,
 *       10, // Max 10 tasks
 *       "Focus on MVP features for a task management app with authentication and real-time sync"
 *     );
 *   };
 *
 *   const handleAdd = async () => {
 *     const created = await addSelectedTasks(project._id);
 *     if (created.length > 0) {
 *       onClose();
 *     }
 *   };
 *
 *   return (
 *     <Dialog>
 *       <Button onClick={handleGenerate} disabled={generating}>
 *         {generating ? "Generating..." : "Generate Tasks"}
 *       </Button>
 *       {drafts.map((draft) => (
 *         <Card key={draft.id}>
 *           <Checkbox checked={draft.selected} onCheckedChange={() => toggleDraft(draft.id)} />
 *           <Input
 *             value={draft.title}
 *             onChange={(e) => updateDraft(draft.id, { title: e.target.value })}
 *           />
 *           <Textarea
 *             value={draft.description}
 *             onChange={(e) => updateDraft(draft.id, { description: e.target.value })}
 *           />
 *           <Select
 *             value={draft.priority}
 *             onValueChange={(priority) => updateDraft(draft.id, { priority })}
 *           >
 *             <SelectItem value="urgent">Urgent</SelectItem>
 *             <SelectItem value="high">High</SelectItem>
 *             <SelectItem value="medium">Medium</SelectItem>
 *             <SelectItem value="low">Low</SelectItem>
 *           </Select>
 *           {draft.subtasks.map((subtask, idx) => (
 *             <div key={idx}>{subtask}</div>
 *           ))}
 *         </Card>
 *       ))}
 *       <Button onClick={handleAdd} disabled={adding || drafts.filter(d => d.selected).length === 0}>
 *         {adding ? "Adding..." : `Add ${drafts.filter(d => d.selected).length} Tasks`}
 *       </Button>
 *     </Dialog>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Calls `/api/ai/generate-tasks` endpoint which uses Claude API (incurs AI usage costs)
 * - Calls `/api/tasks/bulk-create` endpoint to create multiple tasks in one request
 * - Displays error toast on generation or creation failure via `toast.error()`
 * - Displays success toast after tasks are created via `toast.success()`
 * - Dispatches `pillar:tasks-created` window event to notify `useTasks` instances across tabs/components
 * - Clears drafts automatically after successful bulk creation
 * - All drafts are selected by default after generation
 *
 * **Implementation Details:**
 * - Uses plain `fetch()` (not `offlineFetch`) since AI generation requires network connectivity
 * - Error handling displays user-friendly messages via Sonner toast
 * - Optional parameters (maxCount, context) are conditionally included in generation request body
 * - Draft IDs use format `draft-${timestamp}-${index}` for uniqueness
 * - Real-time sync via custom event ensures `useTasks` hooks update without SSE dependency
 * - Returns empty array from `addSelectedTasks` if no drafts are selected or on error
 */
export function useGenerateTasks(): UseGenerateTasksReturn {
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);

  const generateTasks = useCallback(
    async (projectId: string, maxCount?: number, context?: string) => {
      try {
        setGenerating(true);
        const body: Record<string, unknown> = { projectId };
        if (maxCount) body.maxCount = maxCount;
        if (context) body.context = context;

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
        const res = await fetch("/api/tasks/bulk-create", {
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

        // Notify useTasks instances to add the created tasks to state
        window.dispatchEvent(
          new CustomEvent("pillar:tasks-created", {
            detail: { tasks: data.tasks, projectId },
          }),
        );

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
