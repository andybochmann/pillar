"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to potential permission changes via visibility events.
 *
 * The Browser Notification API does not provide a standard event for permission changes.
 * As a workaround, this function listens to `visibilitychange` events to detect when
 * the user might have changed notification permissions in browser settings while the tab
 * was in the background.
 *
 * @param callback - Function to call when visibility changes (potential permission change)
 * @returns Cleanup function that removes event listeners
 */
function subscribe(callback: () => void) {
  // There's no standard event for permission changes, but we can listen
  // to visibility changes to check if permission was changed in browser settings
  document.addEventListener("visibilitychange", callback);
  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
}

/**
 * Gets the current notification permission state from the browser.
 *
 * Uses the Browser Notification API (`Notification.permission`) to retrieve the
 * current permission state. Returns "default" if the API is not supported.
 *
 * @returns Current permission state: "granted", "denied", or "default"
 */
function getSnapshot(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

/**
 * Gets the server-side snapshot for SSR compatibility.
 *
 * Always returns "default" during server-side rendering since notification permissions
 * are a browser-only feature.
 *
 * @returns Always "default" for server-side rendering
 */
function getServerSnapshot(): NotificationPermission {
  return "default";
}

/**
 * Hook that manages Browser Notification API permission state.
 *
 * Provides access to the current notification permission state and a function to request
 * permission from the user. Implemented with React's useSyncExternalStore for optimal
 * performance and SSR compatibility.
 *
 * **Browser Notification API Permission Handling:**
 * - Reads current permission state from `Notification.permission`
 * - Provides `requestPermission()` to trigger the browser's permission prompt
 * - Returns "granted", "denied", or "default" (not yet asked)
 * - Detects browser support via `"Notification" in window`
 *
 * **Permission State Management:**
 * - Uses `useSyncExternalStore` to subscribe to permission state changes
 * - Subscribes to `visibilitychange` events as proxy for potential permission changes
 * - Re-checks permission when tab becomes visible again (in case user changed it in settings)
 * - Provides `isSupported` flag to check if browser supports notifications
 *
 * **SSR Compatibility:**
 * - Returns "default" permission during server-side rendering
 * - Safely handles undefined window/Notification objects
 *
 * @returns Object containing:
 *   - `permission`: Current notification permission state ("granted" | "denied" | "default")
 *   - `requestPermission`: Async function to request notification permission from user
 *   - `isSupported`: Boolean indicating if browser supports the Notification API
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const { permission, requestPermission, isSupported } = useNotificationPermission();
 *
 *   if (!isSupported) {
 *     return <div>Notifications are not supported in this browser.</div>;
 *   }
 *
 *   const handleEnableNotifications = async () => {
 *     const result = await requestPermission();
 *     if (result === "granted") {
 *       toast.success("Notifications enabled!");
 *     } else if (result === "denied") {
 *       toast.error("Notifications denied. Please enable in browser settings.");
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <p>Current permission: {permission}</p>
 *       {permission === "default" && (
 *         <button onClick={handleEnableNotifications}>
 *           Enable Notifications
 *         </button>
 *       )}
 *       {permission === "granted" && (
 *         <p>✓ Notifications are enabled</p>
 *       )}
 *       {permission === "denied" && (
 *         <p>✗ Notifications are blocked. Enable in browser settings.</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * - The browser's permission prompt can only be triggered by user interaction (e.g., button click)
 * - Once permission is "denied", the app cannot re-prompt - user must enable manually in browser settings
 * - Permission state may change outside the app (user changes it in browser settings)
 * - The `visibilitychange` event is used as a proxy to detect potential permission changes
 */
export function useNotificationPermission() {
  const permission = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "default" as NotificationPermission;
    }

    if (Notification.permission === "granted") {
      return "granted" as NotificationPermission;
    }

    const result = await Notification.requestPermission();
    return result;
  }, []);

  const isSupported =
    typeof window !== "undefined" && "Notification" in window;

  return { permission, requestPermission, isSupported };
}
