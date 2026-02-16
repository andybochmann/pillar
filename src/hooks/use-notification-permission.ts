"use client";

import { useState, useEffect } from "react";

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;

    Notification.requestPermission().then((result) => {
      setPermission(result);
    });
  }, []);

  return { permission };
}
