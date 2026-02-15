"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  // There's no standard event for permission changes, but we can listen
  // to visibility changes to check if permission was changed in browser settings
  document.addEventListener("visibilitychange", callback);
  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
}

function getSnapshot(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

function getServerSnapshot(): NotificationPermission {
  return "default";
}

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
