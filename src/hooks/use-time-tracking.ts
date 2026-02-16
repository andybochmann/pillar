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

/**
 * Manages time tracking operations for tasks with automatic session conflict resolution.
 *
 * This hook provides a complete interface for managing time tracking sessions, including:
 * - Starting time sessions with automatic stop of conflicting sessions
 * - Stopping active time sessions
 * - Deleting historical time sessions
 * - Tracking which task is currently active for the current user
 * - Offline mutation queuing via offlineFetch
 * - Optimistic local state updates for immediate UI feedback
 *
 * @param {Task[]} tasks - Array of tasks to track time for
 * @param {React.Dispatch<React.SetStateAction<Task[]>>} setTasks - State setter for tasks (from parent hook)
 * @param {string} currentUserId - ID of the current user to filter sessions
 *
 * @returns {UseTimeTrackingReturn} Object containing:
 *   - `startTracking`: Function to start a new time session (auto-stops other active sessions)
 *   - `stopTracking`: Function to stop the active time session for a task
 *   - `deleteSession`: Function to delete a specific historical time session
 *   - `activeTaskId`: ID of the task currently being tracked by the user, or null
 *
 * @example
 * ```tsx
 * function TaskTimer({ projectId }: { projectId: string }) {
 *   const { data: session } = useSession();
 *   const { tasks, setTasks } = useTasks([], projectId);
 *   const {
 *     startTracking,
 *     stopTracking,
 *     deleteSession,
 *     activeTaskId
 *   } = useTimeTracking(tasks, setTasks, session?.user?.id || "");
 *
 *   const handleStart = async (taskId: string) => {
 *     try {
 *       await startTracking(taskId); // Auto-stops other tasks
 *       toast.success("Timer started");
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   const handleStop = async (taskId: string) => {
 *     try {
 *       await stopTracking(taskId);
 *       toast.success("Timer stopped");
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {tasks.map(task => (
 *         <div key={task._id}>
 *           {activeTaskId === task._id ? (
 *             <Button onClick={() => handleStop(task._id)}>Stop</Button>
 *           ) : (
 *             <Button onClick={() => handleStart(task._id)}>Start</Button>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Auto-Stop Behavior:**
 * - When `startTracking` is called, the API automatically stops any other active session for the current user
 * - The hook optimistically updates local state to close all other active sessions immediately
 * - This ensures only one task can be tracked at a time per user
 *
 * **Derived State:**
 * - `activeTaskId` is computed via `useMemo` by finding the first task with an open session for the current user
 * - Recalculates whenever `tasks` or `currentUserId` changes
 *
 * **Side Effects:**
 * - All mutations use `offlineFetch` to queue operations when offline
 * - Optimistic updates are applied immediately to the local task list
 * - Changes are reflected across tabs/users via real-time sync (managed by parent `useTasks` hook)
 */
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
