"use client";

import { useEffect, useRef } from "react";
import type { SyncEvent } from "@/lib/event-bus";

/**
 * Subscribes to real-time sync events for a specific entity type.
 *
 * **Event Filtering by Entity Type:**
 * - Listens to `pillar:sync` custom events from `useRealtimeSync`
 * - Filters events by entity type (`task`, `project`, `category`, etc.)
 * - Only invokes handler for events matching the specified entity
 *
 * **Handler Updates:**
 * - Uses a ref to track the latest handler, allowing it to change without re-subscribing
 * - Avoids unnecessary event listener churn when handler function changes
 *
 * **Memory Management:**
 * - Removes event listener on unmount to prevent memory leaks
 * - Re-subscribes only when entity type changes (not on every render)
 *
 * @param entity - The entity type to filter events by (e.g., "task", "project")
 * @param handler - Callback invoked when a sync event for this entity is received
 *
 * @example
 * useSyncSubscription("task", (event) => {
 *   if (event.action === "update") {
 *     setTasks((prev) => prev.map((t) => t._id === event.id ? { ...t, ...event.data } : t));
 *   }
 * });
 */
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
