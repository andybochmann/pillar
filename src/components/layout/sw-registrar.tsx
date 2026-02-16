"use client";

import { useEffect } from "react";

export function SwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          await navigator.serviceWorker.ready;
          // Warm the SW cache with the current page so it's available offline
          fetch(window.location.href).catch(() => {});
        })
        .catch(() => {
          // SW registration failed — non-critical, app works without it
        });
    }
  }, []);

  return null;
}
