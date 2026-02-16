"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "./use-online-status";
import { replayQueue } from "@/lib/sync";
import { getQueueCount } from "@/lib/offline-queue";
import { toast } from "sonner";

/**
 * Hook that manages the offline request queue stored in IndexedDB.
 *
 * This hook provides comprehensive offline support by:
 * - Tracking the number of pending requests in the IndexedDB queue
 * - Automatically syncing queued requests when the browser comes back online
 * - Providing manual sync control for user-triggered synchronization
 * - Displaying toast notifications for sync success/failure
 * - Dispatching custom events when sync completes for app-wide coordination
 *
 * The hook uses IndexedDB to persist failed API requests during offline periods
 * and automatically replays them when connectivity is restored. This ensures
 * no data loss when users work offline.
 *
 * @returns Object containing:
 *   - isOnline: Boolean indicating current network connectivity status
 *   - queueCount: Number of pending requests in the IndexedDB queue
 *   - syncing: Boolean indicating if sync is currently in progress
 *   - syncNow: Function to manually trigger queue synchronization
 *   - refreshCount: Function to manually refresh the queue count from IndexedDB
 *
 * @example
 * ```tsx
 * function OfflineIndicator() {
 *   const { isOnline, queueCount, syncing, syncNow } = useOfflineQueue();
 *
 *   if (isOnline && queueCount === 0) return null;
 *
 *   return (
 *     <div>
 *       {!isOnline && <span>Offline</span>}
 *       {queueCount > 0 && (
 *         <button onClick={syncNow} disabled={syncing}>
 *           Sync {queueCount} pending change{queueCount === 1 ? "" : "s"}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOfflineQueue() {
  const { isOnline } = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  /**
   * Refreshes the queue count from IndexedDB.
   * Queries the offline queue database to get the current number of pending requests.
   */
  const refreshCount = useCallback(async () => {
    const count = await getQueueCount();
    setQueueCount(count);
  }, []);

  /**
   * Manually triggers synchronization of the offline queue.
   *
   * Replays all pending requests from IndexedDB to the server. Shows toast
   * notifications for success/failure and dispatches a custom "pillar:sync-complete"
   * event when sync finishes. Uses a ref to prevent concurrent sync operations.
   *
   * @remarks
   * - Automatically called when browser comes back online
   * - Can be called manually by user interaction (e.g., "Sync Now" button)
   * - Prevents concurrent syncs using syncingRef
   * - Updates queue count after sync completes
   */
  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await replayQueue();
      if (result.succeeded > 0) {
        toast.success(`${result.succeeded} change${result.succeeded === 1 ? "" : "s"} synced`);
        window.dispatchEvent(new CustomEvent("pillar:sync-complete"));
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} change${result.failed === 1 ? "" : "s"} failed to sync`);
      }
      await refreshCount();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0 && !syncingRef.current) {
      syncNow();
    }
  }, [isOnline, queueCount, syncNow]);

  // Refresh count on mount and when online status changes
  useEffect(() => {
    refreshCount();
  }, [isOnline, refreshCount]);

  // Listen for Background Sync completion from service worker
  useEffect(() => {
    function onSwMessage(event: MessageEvent) {
      if (event.data?.type === "SYNC_COMPLETE") {
        refreshCount();
        window.dispatchEvent(new CustomEvent("pillar:sync-complete"));
      }
    }
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [refreshCount]);

  return { isOnline, queueCount, syncing, syncNow, refreshCount };
}
