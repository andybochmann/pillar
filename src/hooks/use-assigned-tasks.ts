"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Task } from "@/types";

interface UseAssignedTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Read-only fetch of open (not completed) tasks assigned to `userId` across all
 * of the current user's accessible projects. Relies on `GET /api/tasks`, which
 * already scopes results to accessible projects and enforces access server-side
 * — the passed id is only used to filter, never to bypass authorization.
 */
export function useAssignedTasks(userId: string): UseAssignedTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write state (guards out-of-order responses).
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/tasks?assigneeId=${encodeURIComponent(userId)}&completed=false`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load tasks");
      }
      const data = await res.json();
      if (id !== requestId.current) return;
      setTasks(data);
    } catch (err) {
      if (id !== requestId.current) return;
      setError((err as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tasks, loading, error, refetch };
}
