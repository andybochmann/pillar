"use client";

import { useEffect, useRef, useCallback } from "react";
import { getSessionId } from "@/lib/session-id";

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export function useRealtimeSync(): void {
  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const isFirstConnectionRef = useRef(true);
  const mountedRef = useRef(true);
  const connectRef = useRef<() => void>(undefined!);

  const connect = useCallback(() => {
    if (!navigator.onLine || !mountedRef.current) return;
    // Never open a second EventSource while one is already live — that would
    // leak an orphaned connection and double every event.
    if (esRef.current) return;

    const sessionId = getSessionId();
    const es = new EventSource(`/api/events?sessionId=${sessionId}`);
    esRef.current = es;

    es.onopen = () => {
      retriesRef.current = 0;

      if (!isFirstConnectionRef.current) {
        window.dispatchEvent(new CustomEvent("pillar:reconnected"));
      }
      isFirstConnectionRef.current = false;
    };

    es.addEventListener("sync", (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      window.dispatchEvent(new CustomEvent("pillar:sync", { detail: data }));
    });

    es.addEventListener("notification", (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      window.dispatchEvent(
        new CustomEvent("pillar:notification", { detail: data }),
      );
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;

      if (!mountedRef.current) return;

      retriesRef.current++;

      // Exponential backoff with jitter, capped at MAX_RECONNECT_DELAY_MS.
      // Retry indefinitely (capped) so the tab recovers realtime sync even
      // after a long server outage — giving up permanently would strand it.
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, retriesRef.current - 1),
        MAX_RECONNECT_DELAY_MS,
      );
      const jitter = delay * 0.1 * Math.random();
      setTimeout(() => {
        // Bail if a connection was re-established in the meantime (M9).
        if (mountedRef.current && !esRef.current && connectRef.current) {
          connectRef.current();
        }
      }, delay + jitter);
    };
  }, []);

  // Store connect in ref for self-reference
  useEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    mountedRef.current = true;
    connect();

    const handleOnline = () => {
      retriesRef.current = 0;
      if (!esRef.current) connect();
    };

    const handleOffline = () => {
      esRef.current?.close();
      esRef.current = null;
    };

    // When the tab regains focus / visibility, reset the backoff and reconnect
    // immediately if the connection has dropped — recovers quickly after a long
    // background outage instead of waiting out a capped 30s backoff.
    const handleResume = () => {
      if (document.visibilityState === "hidden") return;
      retriesRef.current = 0;
      if (!esRef.current) connect();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleResume);

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    };
  }, [connect]);
}
