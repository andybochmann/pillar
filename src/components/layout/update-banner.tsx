"use client";

import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;

    // Capture at mount time — if null, this is a first-time SW install, not an update.
    const hadController = !!sw.controller;

    function handleControllerChange() {
      if (hadController) {
        setUpdateAvailable(true);
      }
    }

    sw.addEventListener("controllerchange", handleControllerChange);
    return () => {
      sw.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-primary/10 px-4 py-2 text-sm font-medium dark:bg-primary/20"
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      <span>A new version is available.</span>
      <Button size="xs" onClick={() => window.location.reload()} className="ml-1">
        Refresh
      </Button>
      <button
        onClick={() => setUpdateAvailable(false)}
        aria-label="Dismiss update notification"
        className="ml-1 rounded p-1 hover:bg-primary/10 dark:hover:bg-primary/20"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
