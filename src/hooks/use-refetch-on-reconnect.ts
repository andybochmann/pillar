"use client";

import { useEffect } from "react";

/**
 * Automatically refetches data when the SSE connection reconnects.
 *
 * **Reconnection Triggers:**
 * - `pillar:reconnected` - Dispatched by `useRealtimeSync` after SSE reconnects
 * - `pillar:sync-complete` - Dispatched after offline queue sync completes
 *
 * **Use Case:**
 * - Ensures UI stays in sync after temporary disconnections
 * - Fetches any updates that occurred while offline or disconnected
 *
 * **Memory Management:**
 * - Removes event listeners on unmount to prevent memory leaks
 * - Re-subscribes only when refetch function changes
 *
 * @param refetch - Function to call when reconnection occurs (typically a data-fetching function)
 *
 * @example
 * const fetchTasks = useCallback(async () => {
 *   const res = await fetch("/api/tasks");
 *   setTasks(await res.json());
 * }, []);
 *
 * useRefetchOnReconnect(fetchTasks);
 */
export function useRefetchOnReconnect(refetch: () => void): void {
  useEffect(() => {
    window.addEventListener("pillar:reconnected", refetch);
    window.addEventListener("pillar:sync-complete", refetch);
    return () => {
      window.removeEventListener("pillar:reconnected", refetch);
      window.removeEventListener("pillar:sync-complete", refetch);
    };
  }, [refetch]);
}
