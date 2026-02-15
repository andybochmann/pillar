"use client";

import { useEffect } from "react";

export function useRefetchOnReconnect(refetch: () => void): void {
  useEffect(() => {
    window.addEventListener("pillar:reconnected", refetch);
    window.addEventListener("pillar:sync-complete", refetch);
    return () => {
      window.removeEventListener("pillar:reconnected", refetch);
      window.removeEventListener("pillar:sync-complete", refetch);
    };
  }, [refetch]);
}
