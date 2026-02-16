"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { requestPersistentStorage } from "@/lib/storage-persist";

const PERSIST_DENIED_KEY = "pillar:persist-denied-shown";

export function SwRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function setupServiceWorker() {
      try {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        fetch(window.location.href).catch(() => {});

        const result = await requestPersistentStorage();
        if (result === "denied" && !sessionStorage.getItem(PERSIST_DENIED_KEY)) {
          sessionStorage.setItem(PERSIST_DENIED_KEY, "1");
          toast.info("Offline data may be cleared by the browser");
        }
      } catch {
        // SW registration failed — non-critical, app works without it
      }
    }

    setupServiceWorker();
  }, []);

  return null;
}
