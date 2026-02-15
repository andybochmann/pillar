"use client";

import { useCallback, useMemo } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import type { Task } from "@/types";

interface UseTimeTrackingReturn {
  startTracking: (taskId: string) => Promise<Task>;
  stopTracking: (taskId: string) => Promise<Task>;
  deleteSession: (taskId: string, sessionId: string) => Promise<Task>;
  activeTaskId: string | null;
}

export function useTimeTracking(
  tasks: Task[],
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  currentUserId: string,
): UseTimeTrackingReturn {
  const activeTaskId = useMemo(
    () =>
      tasks.find((task) =>
        task.timeSessions?.some(
          (s) => s.userId === currentUserId && !s.endedAt,
        ),
      )?._id ?? null,
    [tasks, currentUserId],
  );

  const updateTaskInList = useCallback(
    (updated: Task) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === updated._id ? updated : t)),
      );
    },
    [setTasks],
  );

  const startTracking = useCallback(
    async (taskId: string): Promise<Task> => {
      const res = await offlineFetch(`/api/tasks/${taskId}/time-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start tracking");
      }

      const updated: Task = await res.json();

      // API auto-stops other tasks; update all affected tasks locally
      setTasks((prev) =>
        prev.map((t) => {
          if (t._id === updated._id) return updated;
          // Close any active session for this user on other tasks
          if (
            t.timeSessions?.some(
              (s) => s.userId === currentUserId && !s.endedAt,
            )
          ) {
            return {
              ...t,
              timeSessions: t.timeSessions.map((s) =>
                s.userId === currentUserId && !s.endedAt
                  ? { ...s, endedAt: new Date().toISOString() }
                  : s,
              ),
            };
          }
          return t;
        }),
      );

      return updated;
    },
    [setTasks, currentUserId],
  );

  const stopTracking = useCallback(
    async (taskId: string): Promise<Task> => {
      const res = await offlineFetch(`/api/tasks/${taskId}/time-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to stop tracking");
      }

      const updated: Task = await res.json();
      updateTaskInList(updated);
      return updated;
    },
    [updateTaskInList],
  );

  const deleteSession = useCallback(
    async (taskId: string, sessionId: string): Promise<Task> => {
      const res = await offlineFetch(
        `/api/tasks/${taskId}/time-sessions/${sessionId}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete session");
      }

      const updated: Task = await res.json();
      updateTaskInList(updated);
      return updated;
    },
    [updateTaskInList],
  );

  return { startTracking, stopTracking, deleteSession, activeTaskId };
}
