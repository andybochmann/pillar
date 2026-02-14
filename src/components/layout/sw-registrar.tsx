"use client";

import { useEffect } from "react";

export function SwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — non-critical, app works without it
      });
    }
  }, []);

  return null;
}
