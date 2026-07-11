"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Task } from "@/types";

interface BulkDeleteOptions {
  projectId: string;
  taskIds?: string[];
  olderThanDays?: number;
}

interface UseArchivedTasksReturn {
  archivedTasks: Task[];
  loading: boolean;
  error: string | null;
  fetchArchived: (projectId: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;
  permanentDeleteTask: (id: string) => Promise<void>;
  bulkDeleteArchived: (options: BulkDeleteOptions) => Promise<number>;
}

export function useArchivedTasks(): UseArchivedTasksReturn {
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remember the last project fetched so we can refetch it after reconnect.
  const lastProjectIdRef = useRef<string | null>(null);
  // Mirror the latest archived tasks so callbacks can read the current list
  // synchronously (a setState updater runs during render, too late to capture).
  const archivedTasksRef = useRef<Task[]>([]);
  useEffect(() => {
    archivedTasksRef.current = archivedTasks;
  }, [archivedTasks]);

  const fetchArchived = useCallback(async (projectId: string) => {
    lastProjectIdRef.current = projectId;
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
    // An offline PATCH echoes only the patched fields (no projectId), so merge
    // over the known archived task to keep a complete entity — otherwise the
    // dispatched sync event would carry projectId=undefined and the board would
    // fail to add the task back.
    const serverResult: Partial<Task> = await res.json();
    const existing = archivedTasksRef.current.find((t) => t._id === id);
    setArchivedTasks((prev) => prev.filter((t) => t._id !== id));
    const restored = {
      ...(existing ?? {}),
      ...serverResult,
      _id: id,
      archived: false,
    } as Task;

    // Dispatch local sync event so the board adds the task back instantly
    // (SSE skips events from the same tab, so the board won't get it otherwise)
    window.dispatchEvent(
      new CustomEvent("pillar:sync", {
        detail: {
          entity: "task",
          action: "updated",
          entityId: id,
          projectId: restored.projectId,
          data: restored,
          timestamp: Date.now(),
        },
      }),
    );
  }, []);

  const permanentDeleteTask = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete task");
    }
    setArchivedTasks((prev) => prev.filter((t) => t._id !== id));
  }, []);

  const bulkDeleteArchived = useCallback(
    async ({ projectId, taskIds, olderThanDays }: BulkDeleteOptions) => {
      const body: Record<string, unknown> = { projectId };
      if (taskIds) body.taskIds = taskIds;
      if (olderThanDays) body.olderThanDays = olderThanDays;

      const res = await offlineFetch("/api/tasks/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete archived tasks");
      }

      const data = await res.json();
      const deletedCount: number = data.deletedCount ?? 0;

      // Optimistic state update
      if (taskIds) {
        const idsSet = new Set(taskIds);
        setArchivedTasks((prev) => prev.filter((t) => !idsSet.has(t._id)));
      } else if (olderThanDays) {
        const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
        setArchivedTasks((prev) =>
          prev.filter(
            (t) =>
              !t.archivedAt || new Date(t.archivedAt).getTime() >= cutoff,
          ),
        );
      } else {
        setArchivedTasks([]);
      }

      return deletedCount as number;
    },
    [],
  );

  // Catch up after a disconnect / offline-queue sync.
  useRefetchOnReconnect(
    useCallback(() => {
      if (lastProjectIdRef.current) fetchArchived(lastProjectIdRef.current);
    }, [fetchArchived]),
  );

  return {
    archivedTasks,
    loading,
    error,
    fetchArchived,
    unarchiveTask,
    permanentDeleteTask,
    bulkDeleteArchived,
  };
}
