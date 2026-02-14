"use client";

import { useState, useCallback } from "react";
import type { Task } from "@/types";

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
        | "completedAt"
      >
    >,
  ) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
}

export function useTasks(initialTasks: Task[] = []): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch tasks");
      }
      setTasks(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
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
      const res = await fetch("/api/tasks", {
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
      const res = await fetch(`/api/tasks/${id}`, {
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
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete task");
    }
    setTasks((prev) => prev.filter((t) => t._id !== id));
  }, []);

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
