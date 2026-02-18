"use client";

import { useCallback, useMemo } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import type { Task } from "@/types";

interface UseTimeTrackingReturn {
  startTracking: (taskId: string) => Promise<Task>;
  stopTracking: (taskId: string) => Promise<Task>;
  deleteSession: (taskId: string, sessionId: string) => Promise<Task>;
  activeTaskIds: Set<string>;
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
 *   - `startTracking`: Function to start a new time session
 *   - `stopTracking`: Function to stop the active time session for a task
 *   - `deleteSession`: Function to delete a specific historical time session
 *   - `activeTaskIds`: Set of task IDs currently being tracked by the user
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
 *     activeTaskIds
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
 *           {activeTaskIds.has(task._id) ? (
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
 * **Concurrent Timers:**
 * - Multiple tasks can be tracked simultaneously — there is no auto-stop behavior
 * - `activeTaskIds` is a Set of all task IDs with an open session for the current user
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
  const activeTaskIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((task) =>
            task.timeSessions?.some(
              (s) => s.userId === currentUserId && !s.endedAt,
            ),
          )
          .map((task) => task._id),
      ),
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
      updateTaskInList(updated);
      return updated;
    },
    [updateTaskInList],
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

  return { startTracking, stopTracking, deleteSession, activeTaskIds };
}
