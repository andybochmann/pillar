"use client";

import { useState, useEffect, useCallback } from "react";
import { useOnlineStatus } from "./use-online-status";
import { replayQueue } from "@/lib/sync";
import { getQueueCount } from "@/lib/offline-queue";
import { toast } from "sonner";

export function useOfflineQueue() {
  const { isOnline } = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getQueueCount();
    setQueueCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await replayQueue();
      if (result.succeeded > 0) {
        toast.success(
          `${result.succeeded} change${result.succeeded === 1 ? "" : "s"} synced`,
        );
      }
      if (result.failed > 0) {
        toast.error(
          `${result.failed} change${result.failed === 1 ? "" : "s"} failed to sync`,
        );
      }
      await refreshCount();
    } finally {
      setSyncing(false);
    }
  }, [refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0 && !syncing) {
      syncNow();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh count on mount and when online status changes
  useEffect(() => {
    refreshCount();
  }, [isOnline, refreshCount]);

  return { isOnline, queueCount, syncing, syncNow, refreshCount };
}
