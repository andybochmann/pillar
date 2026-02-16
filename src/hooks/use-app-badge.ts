"use client";

import { useEffect, useRef, useCallback } from "react";

async function fetchOverdueCount(): Promise<number> {
  try {
    const res = await fetch("/api/stats/overdue-count");
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

function isBadgingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.setAppBadge === "function" &&
    typeof navigator.clearAppBadge === "function"
  );
}

export function useAppBadge(): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateBadge = useCallback(async () => {
    if (!isBadgingSupported()) return;

    const count = await fetchOverdueCount();

    if (count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }

    // Also update via service worker for background persistence
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "UPDATE_BADGE",
        count,
      });
    }
  }, []);

  const debouncedUpdate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateBadge();
    }, 2000);
  }, [updateBadge]);

  useEffect(() => {
    // Initial badge update on mount
    updateBadge();

    function onSync(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.entity === "task") {
        debouncedUpdate();
      }
    }

    function onSyncComplete() {
      updateBadge();
    }

    function onReconnected() {
      updateBadge();
    }

    window.addEventListener("pillar:sync", onSync);
    window.addEventListener("pillar:sync-complete", onSyncComplete);
    window.addEventListener("pillar:reconnected", onReconnected);

    return () => {
      window.removeEventListener("pillar:sync", onSync);
      window.removeEventListener("pillar:sync-complete", onSyncComplete);
      window.removeEventListener("pillar:reconnected", onReconnected);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [updateBadge, debouncedUpdate]);
}
