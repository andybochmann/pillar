"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to browser online/offline events.
 * Listens to window "online" and "offline" events to detect network connectivity changes.
 *
 * @param callback - Function to call when online/offline status changes
 * @returns Cleanup function that removes event listeners
 */
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Gets the current online status from the browser.
 * Uses the Navigator.onLine API to determine if the browser has network connectivity.
 *
 * @returns True if browser is online, false if offline
 */
function getSnapshot() {
  return navigator.onLine;
}

/**
 * Gets the server-side snapshot for SSR compatibility.
 * Always returns true during SSR since we assume network connectivity on the server.
 *
 * @returns Always true for server-side rendering
 */
function getServerSnapshot() {
  return true;
}

/**
 * Hook that tracks browser online/offline status.
 *
 * Uses the Navigator.onLine API and listens to browser "online" and "offline" events
 * to detect network connectivity changes in real-time. Implemented with React's
 * useSyncExternalStore for optimal performance and SSR compatibility.
 *
 * @returns Object containing:
 *   - isOnline: Boolean indicating current network connectivity status
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline } = useOnlineStatus();
 *
 *   return (
 *     <div>
 *       Status: {isOnline ? "Online" : "Offline"}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return { isOnline };
}
