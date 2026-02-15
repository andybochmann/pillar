"use client";

import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";

interface NotificationItemProps {
  notification: Notification;
  onClick?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onSnooze?: (id: string) => void;
  className?: string;
  disabled?: boolean;
}

const notificationTypeLabels: Record<NotificationType, string> = {
  "due-soon": "Due Soon",
  overdue: "Overdue",
  reminder: "Reminder",
  "daily-summary": "Daily Summary",
};

const notificationTypeColors: Record<
  NotificationType,
  "default" | "destructive" | "outline" | "secondary"
> = {
  "due-soon": "default",
  overdue: "destructive",
  reminder: "secondary",
  "daily-summary": "outline",
};

export function NotificationItem({
  notification,
  onClick,
  onMarkAsRead,
  onDismiss,
  onSnooze,
  className,
  disabled = false,
}: NotificationItemProps) {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(notification._id);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onMarkAsRead) {
      onMarkAsRead(notification._id);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onDismiss) {
      onDismiss(notification._id);
    }
  };

  const handleSnooze = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onSnooze) {
      onSnooze(notification._id);
    }
  };

  // Format time - use relative for recent, absolute for older
  const createdDate = new Date(notification.createdAt);
  const hoursSinceCreated = differenceInHours(new Date(), createdDate);
  const timeDisplay =
    hoursSinceCreated < 24
      ? formatDistanceToNow(createdDate, { addSuffix: true })
      : format(createdDate, "MMM d");

  return (
    <div
      className={cn(
        "group relative rounded-md border p-3 transition-colors",
        notification.read
          ? "bg-muted/50 text-muted-foreground"
          : "bg-background hover:bg-accent/50",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || !onClick}
          className="flex-1 min-w-0 text-left"
          aria-label={`${notification.title} notification`}
        >
          <div className="font-medium text-sm truncate">
            {notification.title}
          </div>
          <div className="mt-1 text-xs line-clamp-2">
            {notification.message}
          </div>
        </button>
        <Badge
          variant={notificationTypeColors[notification.type]}
          className="shrink-0 text-[10px]"
        >
          {notificationTypeLabels[notification.type]}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {notification.snoozedUntil ? "Snoozed" : timeDisplay}
        </span>

        {(onMarkAsRead || onDismiss || onSnooze) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notification.read && onMarkAsRead && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleMarkAsRead}
                disabled={disabled}
                aria-label="Mark as read"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            {onSnooze && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleSnooze}
                disabled={disabled}
                aria-label="Snooze notification"
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleDismiss}
                disabled={disabled}
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
