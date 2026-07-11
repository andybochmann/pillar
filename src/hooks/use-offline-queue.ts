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

    const runReplay = async () => {
      try {
        const result = await replayQueue();
        if (result.succeeded > 0) {
          toast.success(`${result.succeeded} change${result.succeeded === 1 ? "" : "s"} synced`);
          window.dispatchEvent(new CustomEvent("pillar:sync-complete"));
        }
        // Surface permanently-rejected (4xx) mutations that were discarded so
        // the user knows they were dropped, not silently retried.
        if (result.permanentFailures > 0) {
          toast.error(
            `${result.permanentFailures} change${result.permanentFailures === 1 ? " was" : "s were"} rejected and discarded`,
          );
        }
        // Remaining transient failures (network/5xx) stay queued for retry.
        // Auth failures are surfaced via the "pillar:auth-required" listener.
        const transient = result.failed - result.permanentFailures;
        if (transient > 0 && !result.authRequired) {
          toast.error(
            `${transient} change${transient === 1 ? "" : "s"} failed to sync — will retry`,
          );
        }
        await refreshCount();
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    };

    if ("locks" in navigator) {
      await navigator.locks.request("pillar-sync", runReplay);
    } else {
      await runReplay();
    }
  }, [refreshCount]);

  // Auto-sync when coming back online.
  // If Background Sync is supported, the service worker handles replay via
  // the "sync" event — no need to also replay from the app layer. Only run
  // app-level sync as a fallback for browsers without Background Sync.
  useEffect(() => {
    if (isOnline && queueCount > 0 && !syncingRef.current) {
      const hasBgSync = "serviceWorker" in navigator && "SyncManager" in window;
      if (hasBgSync) {
        // Let the service worker handle it via Background Sync
        return;
      }
      syncNow();
    }
  }, [isOnline, queueCount, syncNow]);

  // Refresh count on mount and when online status changes
  useEffect(() => {
    refreshCount();
  }, [isOnline, refreshCount]);

  // Keep the count fresh whenever the queue changes (a mutation was enqueued or
  // removed). Without this, queueCount stays stale and auto-sync never fires on
  // flaky networks where mutations queue while navigator.onLine stays true.
  useEffect(() => {
    function onQueueChanged() {
      refreshCount();
    }
    window.addEventListener("pillar:queue-changed", onQueueChanged);
    return () => {
      window.removeEventListener("pillar:queue-changed", onQueueChanged);
    };
  }, [refreshCount]);

  // Prompt re-login when the offline replayer hit an auth redirect.
  useEffect(() => {
    function onAuthRequired() {
      toast.error("Your session expired. Sign in again to sync offline changes.");
    }
    window.addEventListener("pillar:auth-required", onAuthRequired);
    return () => {
      window.removeEventListener("pillar:auth-required", onAuthRequired);
    };
  }, []);

  // Listen for Background Sync completion from service worker
  useEffect(() => {
    function onSwMessage(event: MessageEvent) {
      if (event.data?.type === "SYNC_COMPLETE") {
        refreshCount();
        window.dispatchEvent(new CustomEvent("pillar:sync-complete"));
        const permanentFailures: number = event.data.permanentFailures ?? 0;
        if (permanentFailures > 0) {
          toast.error(
            `${permanentFailures} change${permanentFailures === 1 ? " was" : "s were"} rejected and discarded`,
          );
        }
        if (event.data.authRequired) {
          window.dispatchEvent(new CustomEvent("pillar:auth-required"));
        }
      }
    }
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [refreshCount]);

  return { isOnline, queueCount, syncing, syncNow, refreshCount };
}
