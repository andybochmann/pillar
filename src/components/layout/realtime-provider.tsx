"use client";

import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useAppBadge } from "@/hooks/use-app-badge";

export function RealtimeProvider() {
  useRealtimeSync();
  useNotificationPermission();
  useAppBadge();
  return null;
}
