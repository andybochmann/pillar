"use client";

import { useEffect, useRef, useCallback } from "react";
import { getSessionId } from "@/lib/session-id";

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_CONSECUTIVE_FAILURES = 10;

export function useRealtimeSync(): void {
  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const isFirstConnectionRef = useRef(true);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!navigator.onLine || !mountedRef.current) return;

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
      if (retriesRef.current > MAX_CONSECUTIVE_FAILURES) return;

      // Exponential backoff with jitter
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, retriesRef.current - 1),
        MAX_RECONNECT_DELAY_MS,
      );
      const jitter = delay * 0.1 * Math.random();
      setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay + jitter);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    const handleOnline = () => {
      if (!esRef.current) connect();
    };

    const handleOffline = () => {
      esRef.current?.close();
      esRef.current = null;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connect]);
}
