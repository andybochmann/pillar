"use client";

import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useNotificationPermission } from "@/hooks/use-notification-permission";

export function RealtimeProvider() {
  useRealtimeSync();
  useNotificationPermission();
  return null;
}
