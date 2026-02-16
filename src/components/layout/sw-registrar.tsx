"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { requestPersistentStorage } from "@/lib/storage-persist";

const PERSIST_DENIED_KEY = "pillar:persist-denied-shown";

export function SwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          await navigator.serviceWorker.ready;
          // Warm the SW cache with the current page so it's available offline
          fetch(window.location.href).catch(() => {});

          // Request persistent storage to prevent eviction of offline data
          const result = await requestPersistentStorage();
          if (
            result === "denied" &&
            !sessionStorage.getItem(PERSIST_DENIED_KEY)
          ) {
            sessionStorage.setItem(PERSIST_DENIED_KEY, "1");
            toast.info("Offline data may be cleared by the browser");
          }
        })
        .catch(() => {
          // SW registration failed — non-critical, app works without it
        });
    }
  }, []);

  return null;
}
