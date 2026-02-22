"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import type { Task } from "@/types";

interface UseArchivedTasksReturn {
  archivedTasks: Task[];
  loading: boolean;
  error: string | null;
  fetchArchived: (projectId: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;
  permanentDeleteTask: (id: string) => Promise<void>;
}

export function useArchivedTasks(): UseArchivedTasksReturn {
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchived = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/tasks?projectId=${projectId}&archived=true`,
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch archived tasks");
      }
      setArchivedTasks(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const unarchiveTask = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to unarchive task");
    }
    setArchivedTasks((prev) => prev.filter((t) => t._id !== id));
  }, []);

  const permanentDeleteTask = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete task");
    }
    setArchivedTasks((prev) => prev.filter((t) => t._id !== id));
  }, []);

  return {
    archivedTasks,
    loading,
    error,
    fetchArchived,
    unarchiveTask,
    permanentDeleteTask,
  };
}
