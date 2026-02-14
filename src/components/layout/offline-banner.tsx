"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white dark:bg-amber-600"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      You&apos;re offline — changes will sync when you reconnect
    </div>
  );
}
