"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskCounts } from "@/types";

interface UseTaskCountsReturn {
  counts: TaskCounts | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTaskCounts(): UseTaskCountsReturn {
  const [counts, setCounts] = useState<TaskCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/stats/task-counts");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch task counts");
      }
      setCounts(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    loading,
    error,
    refresh: fetchCounts,
  };
}
