"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notifications";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { useNativePush } from "@/hooks/use-native-push";
import { isNativePlatform } from "@/lib/capacitor";
import { NotificationItem } from "./notification-item";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
  iconSize?: number;
}

export function NotificationBell({
  className,
  iconSize = 18,
}: NotificationBellProps) {
  const { subscribe: pushSubscribe } = usePushSubscription();
  const { subscribe: nativePushSubscribe } = useNativePush();
  const autoSubscribeAttempted = useRef(false);
  const isNative = isNativePlatform();

  // On mount: fetch preferences, auto-subscribe to push if permission is
  // already granted but enableBrowserPush is false, and auto-detect timezone
  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (!data) return;

        // Auto-detect timezone on first use (when still the default "UTC")
        // Once a user selects a timezone in settings, we respect their choice
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTz && data.timezone === "UTC" && detectedTz !== "UTC") {
          fetch("/api/notifications/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timezone: detectedTz }),
          }).catch(() => {});
        }

        // Native Capacitor: auto-register for push on mount
        if (isNative && !data.enableBrowserPush && !autoSubscribeAttempted.current) {
          autoSubscribeAttempted.current = true;
          const subscribed = await nativePushSubscribe();
          if (subscribed) {
            fetch("/api/notifications/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enableBrowserPush: true }),
            }).catch(() => {});
          }
          return;
        }

        // Web: auto-subscribe to push if notification permission is granted
        // but the preference hasn't been enabled yet
        if (
          !isNative &&
          !data.enableBrowserPush &&
          !autoSubscribeAttempted.current &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          "serviceWorker" in navigator
        ) {
          autoSubscribeAttempted.current = true;
          const subscribed = await pushSubscribe();
          if (subscribed) {
            fetch("/api/notifications/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enableBrowserPush: true }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [pushSubscribe, nativePushSubscribe, isNative]);

  const {
    notifications,
    fetchNotifications,
    markAsRead,
    markAsDismissed,
    dismissAll,
    snoozeNotification,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications({ read: false, dismissed: false, limit: 10 });
  }, [fetchNotifications]);

  // Calculate unread count (unread AND not dismissed)
  const unreadCount = notifications.filter(
    (n) => !n.read && !n.dismissed
  ).length;

  const activeNotifications = notifications.filter((n) => !n.dismissed);

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      try {
        await markAsRead(id);
      } catch {
        toast.error("Failed to mark notification as read");
      }
    },
    [markAsRead]
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        await markAsDismissed(id);
      } catch {
        toast.error("Failed to dismiss notification");
      }
    },
    [markAsDismissed]
  );

  const handleSnooze = useCallback(
    async (id: string) => {
      try {
        const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await snoozeNotification(id, snoozedUntil);
        toast.success("Notification snoozed for 1 hour");
      } catch {
        toast.error("Failed to snooze notification");
      }
    },
    [snoozeNotification]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read && !n.dismissed);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((n) => markAsRead(n._id)));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all notifications as read");
    }
  }, [notifications, markAsRead]);

  const handleDismissAll = useCallback(async () => {
    if (activeNotifications.length === 0) return;
    try {
      await dismissAll();
      toast.success("All notifications cleared");
    } catch {
      toast.error("Failed to clear notifications");
    }
  }, [activeNotifications.length, dismissAll]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"
          }
        >
          <Bell className="h-[--icon-size] w-[--icon-size]" style={{ "--icon-size": `${iconSize}px` } as React.CSSProperties} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px] font-bold"
              aria-label={`${unreadCount} unread`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
          <PopoverDescription className="sr-only">
            Your recent notifications
          </PopoverDescription>
        </PopoverHeader>
        {activeNotifications.length > 0 && (
          <div className="mt-2 flex items-center justify-end gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-7 gap-1 text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissAll}
              className="h-7 gap-1 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </Button>
          </div>
        )}
        <div className="mt-2">
          {activeNotifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          ) : (
            <div className="space-y-2">
              {activeNotifications.slice(0, 5).map((notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDismiss={handleDismiss}
                  onSnooze={handleSnooze}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
