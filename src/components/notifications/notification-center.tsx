"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotificationItem } from "./notification-item";
import { useNotifications } from "@/hooks/use-notifications";
import { toast } from "sonner";
import { CheckCheck, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

interface NotificationCenterProps {
  className?: string;
  initialNotifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
}

type FilterTab = "all" | "unread" | "read";

export function NotificationCenter({
  className,
  initialNotifications = [],
  onNotificationClick,
}: NotificationCenterProps) {
  const {
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAsDismissed,
    snoozeNotification,
    deleteNotification,
  } = useNotifications(initialNotifications);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);

  // Fetch all notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((n) => !n.read && !n.dismissed);
    }
    if (activeTab === "read") {
      return notifications.filter((n) => n.read || n.dismissed);
    }
    return notifications.filter((n) => !n.dismissed);
  }, [notifications, activeTab]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read && !n.dismissed).length,
    [notifications]
  );

  const handleNotificationClick = useCallback(
    async (id: string) => {
      const notification = notifications.find((n) => n._id === id);
      if (!notification) return;

      // Mark as read if unread
      if (!notification.read) {
        try {
          await markAsRead(id);
        } catch {
          toast.error("Failed to mark notification as read");
        }
      }

      // Call optional click handler
      if (onNotificationClick) {
        onNotificationClick(notification);
      }
    },
    [notifications, markAsRead, onNotificationClick]
  );

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
        toast.success("Notification dismissed");
      } catch {
        toast.error("Failed to dismiss notification");
      }
    },
    [markAsDismissed]
  );

  const handleSnooze = useCallback(
    async (id: string) => {
      try {
        // Snooze for 1 hour by default
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
    const unreadNotifications = notifications.filter(
      (n) => !n.read && !n.dismissed
    );
    if (unreadNotifications.length === 0) return;

    setIsMarkingAllAsRead(true);
    try {
      await Promise.all(
        unreadNotifications.map((n) => markAsRead(n._id))
      );
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all notifications as read");
    } finally {
      setIsMarkingAllAsRead(false);
    }
  }, [notifications, markAsRead]);

  const renderContent = () => {
    if (error) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fetchNotifications()}
          >
            Retry
          </Button>
        </div>
      );
    }

    if (loading && notifications.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      );
    }

    if (filteredNotifications.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            {activeTab === "unread"
              ? "No unread notifications"
              : activeTab === "read"
                ? "No read notifications"
                : "No notifications"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeTab === "all" && "You're all caught up!"}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredNotifications.map((notification) => (
          <NotificationItem
            key={notification._id}
            notification={notification}
            onClick={handleNotificationClick}
            onMarkAsRead={handleMarkAsRead}
            onDismiss={handleDismiss}
            onSnooze={handleSnooze}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllAsRead}
            className="gap-1.5"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="all">
            All
            {notifications.filter((n) => !n.dismissed).length > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                ({notifications.filter((n) => !n.dismissed).length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                ({unreadCount})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderContent()}</TabsContent>
        <TabsContent value="unread">{renderContent()}</TabsContent>
        <TabsContent value="read">{renderContent()}</TabsContent>
      </Tabs>
    </div>
  );
}
