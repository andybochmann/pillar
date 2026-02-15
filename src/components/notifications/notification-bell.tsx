"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
  iconSize?: number;
}

export function NotificationBell({
  className,
  iconSize = 18,
}: NotificationBellProps) {
  const { notifications, fetchNotifications } = useNotifications();
  const [open, setOpen] = useState(false);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications({ read: false, dismissed: false, limit: 10 });
  }, [fetchNotifications]);

  // Calculate unread count (unread AND not dismissed)
  const unreadCount = notifications.filter(
    (n) => !n.read && !n.dismissed
  ).length;

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
        <div className="mt-3">
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification._id}
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    notification.read
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-background"
                  )}
                >
                  <div className="font-medium">{notification.title}</div>
                  <div className="mt-1 text-xs">{notification.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
