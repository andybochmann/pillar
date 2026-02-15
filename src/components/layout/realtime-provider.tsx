"use client";

import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export function RealtimeProvider() {
  useRealtimeSync();
  return null;
}
