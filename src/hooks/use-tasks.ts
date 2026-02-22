"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Task } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

type TaskUpdateFields = Pick<
  Task,
  | "title"
  | "description"
  | "columnId"
  | "priority"
  | "dueDate"
  | "recurrence"
  | "order"
  | "labels"
  | "subtasks"
  | "completedAt"
  | "assigneeId"
  | "reminderAt"
  | "archived"
>;

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (data: {
    title: string;
    projectId: string;
    columnId: string;
    priority?: string;
    description?: string;
    assigneeId?: string | null;
  }) => Promise<Task>;
  updateTask: (
    id: string,
    data: Partial<TaskUpdateFields>,
  ) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  duplicateTask: (taskId: string) => Promise<Task>;
  archiveTask: (id: string) => Promise<void>;
}

export function useTasks(initialTasks: Task[] = [], projectId?: string): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(initialTasks.length > 0);

  const fetchTasks = useCallback(async (pid: string) => {
    if (!navigator.onLine && hasData.current) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks?projectId=${pid}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch tasks");
      }
      setTasks(await res.json());
      hasData.current = true;
    } catch (err) {
      if (!hasData.current) {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(
    async (data: {
      title: string;
      projectId: string;
      columnId: string;
      priority?: string;
      description?: string;
      assigneeId?: string | null;
    }) => {
      const res = await offlineFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create task");
      }
      const created: Task = await res.json();
      setTasks((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const updateTask = useCallback(
    async (
      id: string,
      data: Partial<TaskUpdateFields>,
    ) => {
      const res = await offlineFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update task");
      }
      const updated: Task = await res.json();
      setTasks((prev) => prev.map((t) => (t._id === id ? updated : t)));
      return updated;
    },
    [],
  );

  const deleteTask = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete task");
    }
    setTasks((prev) => prev.filter((t) => t._id !== id));
  }, []);

  const duplicateTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t._id === taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      const duplicateData = {
        title: `${task.title} (Copy)`,
        projectId: task.projectId,
        columnId: task.columnId,
        priority: task.priority,
        description: task.description,
        labels: task.labels,
        subtasks: task.subtasks.map((st) => ({
          title: st.title,
          completed: false,
        })),
        assigneeId: task.assigneeId,
      };

      const res = await offlineFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duplicateData),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to duplicate task");
      }
      const duplicated: Task = await res.json();
      setTasks((prev) => [...prev, duplicated]);
      return duplicated;
    },
    [tasks],
  );

  const archiveTask = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to archive task");
    }
    setTasks((prev) => prev.filter((t) => t._id !== id));
  }, []);

  // Real-time sync subscription
  useSyncSubscription("task", useCallback((event: SyncEvent) => {
    const data = event.data as Task | undefined;

    switch (event.action) {
      case "created":
        if (projectId && event.projectId !== projectId) return;
        if (!data) return;
        setTasks((prev) => {
          if (prev.some((t) => t._id === data._id)) return prev;
          return [...prev, data];
        });
        break;
      case "updated":
        if (!data) return;
        if (data.archived) {
          // Archived tasks should be removed from the active list
          setTasks((prev) => prev.filter((t) => t._id !== event.entityId));
        } else {
          setTasks((prev) => {
            const exists = prev.some((t) => t._id === event.entityId);
            if (exists) {
              return prev.map((t) => (t._id === event.entityId ? data : t));
            }
            // Task was restored from archive — add it back to the board
            if (projectId && event.projectId !== projectId) return prev;
            return [...prev, data];
          });
        }
        break;
      case "deleted":
        setTasks((prev) => prev.filter((t) => t._id !== event.entityId));
        break;
      case "reordered":
        if (projectId) fetchTasks(projectId);
        break;
    }
  }, [projectId, fetchTasks]));

  // Listen for bulk-created tasks (e.g. from AI generate)
  useEffect(() => {
    function handler(e: Event) {
      const { tasks: newTasks, projectId: eventProjectId } = (e as CustomEvent).detail;
      if (projectId && eventProjectId !== projectId) return;
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t._id));
        const unique = (newTasks as Task[]).filter((t) => !existingIds.has(t._id));
        if (unique.length === 0) return prev;
        return [...prev, ...unique];
      });
    }
    window.addEventListener("pillar:tasks-created", handler);
    return () => window.removeEventListener("pillar:tasks-created", handler);
  }, [projectId]);

  useRefetchOnReconnect(
    useCallback(() => {
      if (projectId) fetchTasks(projectId);
    }, [projectId, fetchTasks])
  );

  return {
    tasks,
    loading,
    error,
    setTasks,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    duplicateTask,
    archiveTask,
  };
}
