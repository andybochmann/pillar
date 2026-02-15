"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Task } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

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
  }) => Promise<Task>;
  updateTask: (
    id: string,
    data: Partial<
      Pick<
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
      >
    >,
  ) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
}

export function useTasks(initialTasks: Task[] = [], projectId?: string): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (pid: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks?projectId=${pid}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch tasks");
      }
      setTasks(await res.json());
    } catch (err) {
      setError((err as Error).message);
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
      data: Partial<
        Pick<
          Task,
          | "title"
          | "description"
          | "columnId"
          | "priority"
          | "dueDate"
          | "recurrence"
          | "order"
          | "labels"
          | "completedAt"
        >
      >,
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
        setTasks((prev) => prev.map((t) => (t._id === event.entityId ? data : t)));
        break;
      case "deleted":
        setTasks((prev) => prev.filter((t) => t._id !== event.entityId));
        break;
      case "reordered":
        if (projectId) fetchTasks(projectId);
        break;
    }
  }, [projectId, fetchTasks]));

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
  };
}
