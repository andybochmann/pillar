"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskCounts } from "@/types";

interface UseTaskCountsReturn {
  counts: TaskCounts | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches and manages aggregate task count statistics for the current user.
 *
 * This hook provides a simple interface for retrieving task count data, including:
 * - Automatic fetch on component mount
 * - Loading and error state management
 * - Manual refresh capability
 * - Task counts grouped by status (e.g., total, completed, in progress, overdue)
 *
 * @returns {UseTaskCountsReturn} Object containing:
 *   - `counts`: TaskCounts object with aggregate statistics, or null if not yet loaded
 *   - `loading`: Boolean indicating if a fetch operation is in progress
 *   - `error`: Error message string or null
 *   - `refresh`: Function to manually re-fetch task counts
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { counts, loading, error, refresh } = useTaskCounts();
 *
 *   if (loading) return <Skeleton />;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <div>
 *       <h2>My Tasks</h2>
 *       <p>Total: {counts?.total || 0}</p>
 *       <p>Completed: {counts?.completed || 0}</p>
 *       <p>In Progress: {counts?.inProgress || 0}</p>
 *       <p>Overdue: {counts?.overdue || 0}</p>
 *       <Button onClick={refresh}>Refresh</Button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Automatically calls `fetchCounts` on component mount via `useEffect`
 * - Uses plain `fetch()` (not `offlineFetch`) since this is a read-only operation
 * - Does NOT subscribe to real-time updates — use `refresh()` to update counts manually
 *
 * **Typical TaskCounts Structure:**
 * ```typescript
 * {
 *   total: number;        // Total tasks assigned to user
 *   completed: number;    // Tasks with completedAt set
 *   inProgress: number;   // Tasks in non-done columns
 *   overdue: number;      // Tasks past dueDate and not completed
 * }
 * ```
 */
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
