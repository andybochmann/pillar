"use client";

import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { WifiOff, RefreshCw, Loader2 } from "lucide-react";

export function OfflineBanner() {
  const { isOnline, queueCount, syncing, syncNow } = useOfflineQueue();

  // Online with empty queue — hide banner
  if (isOnline && queueCount === 0 && !syncing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white dark:bg-amber-600"
    >
      {!isOnline && (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          You&apos;re offline
          {queueCount > 0 && (
            <span>
              &mdash; {queueCount} pending change{queueCount === 1 ? "" : "s"}
            </span>
          )}
        </>
      )}

      {isOnline && syncing && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Syncing {queueCount} change{queueCount === 1 ? "" : "s"}&hellip;
        </>
      )}

      {isOnline && !syncing && queueCount > 0 && (
        <>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {queueCount} pending change{queueCount === 1 ? "" : "s"}
          <button
            onClick={syncNow}
            className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
          >
            Sync now
          </button>
        </>
      )}
    </div>
  );
}
