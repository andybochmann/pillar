"use client";

import { useState, useCallback, useEffect } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Notification } from "@/types";
import type { NotificationEvent } from "@/lib/event-bus";

type NotificationUpdateFields = Pick<
  Notification,
  "read" | "dismissed" | "snoozedUntil"
>;

interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  fetchNotifications: (params?: {
    read?: boolean;
    dismissed?: boolean;
    type?: string;
    taskId?: string;
    limit?: number;
  }) => Promise<void>;
  markAsRead: (id: string) => Promise<Notification>;
  markAsDismissed: (id: string) => Promise<Notification>;
  snoozeNotification: (id: string, snoozedUntil: string) => Promise<Notification>;
  deleteNotification: (id: string) => Promise<void>;
}

export function useNotifications(
  initialNotifications: Notification[] = []
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(
    async (params?: {
      read?: boolean;
      dismissed?: boolean;
      type?: string;
      taskId?: string;
      limit?: number;
    }) => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams();
        if (params?.read !== undefined) {
          queryParams.set("read", String(params.read));
        }
        if (params?.dismissed !== undefined) {
          queryParams.set("dismissed", String(params.dismissed));
        }
        if (params?.type) {
          queryParams.set("type", params.type);
        }
        if (params?.taskId) {
          queryParams.set("taskId", params.taskId);
        }
        if (params?.limit) {
          queryParams.set("limit", String(params.limit));
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `/api/notifications?${queryString}`
          : "/api/notifications";

        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch notifications");
        }
        setNotifications(await res.json());
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const markAsRead = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to mark notification as read");
    }
    const updated: Notification = await res.json();
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? updated : n))
    );
    return updated;
  }, []);

  const markAsDismissed = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to dismiss notification");
    }
    const updated: Notification = await res.json();
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? updated : n))
    );
    return updated;
  }, []);

  const snoozeNotification = useCallback(
    async (id: string, snoozedUntil: string) => {
      const res = await offlineFetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozedUntil }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to snooze notification");
      }
      const updated: Notification = await res.json();
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? updated : n))
      );
      return updated;
    },
    []
  );

  const deleteNotification = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/notifications/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete notification");
    }
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  }, []);

  // Polling fallback — refetch unread notifications every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Listen for notification events from event bus
  useEffect(() => {
    function handler(e: Event) {
      const event = (e as CustomEvent).detail as NotificationEvent;

      const newNotification: Notification = {
        _id: event.notificationId,
        userId: event.userId,
        taskId: event.taskId,
        type: event.type,
        title: event.title,
        message: event.message,
        read: false,
        dismissed: false,
        metadata: event.metadata,
        createdAt: new Date(event.timestamp).toISOString(),
        updatedAt: new Date(event.timestamp).toISOString(),
      };

      setNotifications((prev) => {
        // Prevent duplicates
        if (prev.some((n) => n._id === newNotification._id)) return prev;
        return [newNotification, ...prev];
      });

      // Show OS notification via Service Worker when tab is not focused
      const swController =
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        !document.hasFocus()
          ? navigator.serviceWorker?.controller
          : null;

      if (swController) {
        swController.postMessage({
          type: "SHOW_NOTIFICATION",
          title: event.title,
          body: event.message,
          data: {
            notificationId: event.notificationId,
            taskId: event.taskId,
            url: "/",
          },
        });
      }
    }

    window.addEventListener("pillar:notification", handler);
    return () => window.removeEventListener("pillar:notification", handler);
  }, []);

  useRefetchOnReconnect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  return {
    notifications,
    loading,
    error,
    setNotifications,
    fetchNotifications,
    markAsRead,
    markAsDismissed,
    snoozeNotification,
    deleteNotification,
  };
}
