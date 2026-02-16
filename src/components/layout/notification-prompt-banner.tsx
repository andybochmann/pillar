"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { usePushSubscription } from "@/hooks/use-push-subscription";

const DISMISS_KEY = "pillar:notification-prompt-dismissed";
const SHOW_DELAY = 2500;

export function NotificationPromptBanner() {
  const { permission, requestPermission } = useNotificationPermission();
  const { subscribe } = usePushSubscription();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (!navigator.serviceWorker) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const timer = setTimeout(() => {
      if (Notification.permission === "default") {
        setVisible(true);
      }
    }, SHOW_DELAY);

    return () => clearTimeout(timer);
  }, []);

  if (!visible || permission !== "default") return null;

  async function handleEnable() {
    setEnabling(true);
    try {
      const result = await requestPermission();

      if (result === "granted") {
        const ok = await subscribe();
        if (ok) {
          await fetch("/api/notifications/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enableBrowserPush: true }),
          });
          toast.success("Notifications enabled!");
        } else {
          toast.error("Failed to set up push notifications.");
        }
        setVisible(false);
      } else if (result === "denied") {
        toast.info(
          "Notifications blocked. You can enable them in your browser settings.",
        );
        setVisible(false);
      }
      // "default" — user closed prompt without choosing → keep banner
    } finally {
      setEnabling(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-primary/10 px-4 py-2 text-sm font-medium dark:bg-primary/20"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      <span>Enable notifications to stay on top of your tasks.</span>
      <Button
        size="xs"
        onClick={handleEnable}
        disabled={enabling}
        className="ml-1"
      >
        {enabling ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Enabling…
          </>
        ) : (
          "Enable"
        )}
      </Button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification prompt"
        className="ml-1 rounded p-1 hover:bg-primary/10 dark:hover:bg-primary/20"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
