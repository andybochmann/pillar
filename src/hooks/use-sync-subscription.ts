"use client";

import { useEffect, useRef } from "react";
import type { SyncEvent } from "@/lib/event-bus";

export function useSyncSubscription(
  entity: SyncEvent["entity"],
  handler: (event: SyncEvent) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    function onSync(e: Event) {
      const event = (e as CustomEvent<SyncEvent>).detail;
      if (event.entity === entity) {
        handlerRef.current(event);
      }
    }

    window.addEventListener("pillar:sync", onSync);
    return () => window.removeEventListener("pillar:sync", onSync);
  }, [entity]);
}
