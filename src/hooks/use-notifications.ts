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
  snoozeNotification: (
    id: string,
    snoozedUntil: string,
  ) => Promise<Notification>;
  deleteNotification: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
}

/**
 * Manages notification state with CRUD operations, real-time synchronization, and offline support.
 *
 * This hook provides a complete interface for managing user notifications, including:
 * - Local state management with optimistic updates
 * - Real-time notification delivery via Server-Sent Events (SSE)
 * - Offline mutation queuing via offlineFetch
 * - Automatic refetch on network reconnection
 * - Support for filtering notifications by read status, type, and task
 *
 * **SSE-Based Notification Subscription:**
 * - Listens to `pillar:notification` custom events dispatched by the event bus
 * - Automatically adds new notifications to the top of the list
 * - Prevents duplicate notifications by checking notification ID before adding
 *
 * **Automatic Refetch:**
 * - Automatically refetches all notifications when network reconnects after being offline
 * - Uses `useRefetchOnReconnect` hook to listen for `pillar:reconnected` events
 *
 * @param {Notification[]} [initialNotifications=[]] - Initial notifications to populate state (typically from server-side props)
 *
 * @returns {UseNotificationsReturn} Object containing:
 *   - `notifications`: Array of notifications in current state
 *   - `loading`: Boolean indicating if a fetch operation is in progress
 *   - `error`: Error message string or null
 *   - `setNotifications`: State setter for external optimistic updates
 *   - `fetchNotifications`: Function to fetch notifications with optional filters (read, dismissed, type, taskId, limit)
 *   - `markAsRead`: Function to mark a notification as read with optimistic update
 *   - `markAsDismissed`: Function to mark a notification as dismissed with optimistic update
 *   - `snoozeNotification`: Function to snooze a notification until a specific date/time with optimistic update
 *   - `deleteNotification`: Function to delete a notification with optimistic update
 *
 * @example
 * ```tsx
 * function NotificationCenter() {
 *   const {
 *     notifications,
 *     loading,
 *     error,
 *     fetchNotifications,
 *     markAsRead,
 *     markAsDismissed,
 *     snoozeNotification,
 *     deleteNotification
 *   } = useNotifications();
 *
 *   useEffect(() => {
 *     // Fetch unread, non-dismissed notifications
 *     fetchNotifications({ read: false, dismissed: false, limit: 50 });
 *   }, []);
 *
 *   const handleMarkAsRead = async (id: string) => {
 *     try {
 *       await markAsRead(id);
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   const handleSnooze = async (id: string) => {
 *     const snoozedUntil = new Date();
 *     snoozedUntil.setHours(snoozedUntil.getHours() + 1);
 *     try {
 *       await snoozeNotification(id, snoozedUntil.toISOString());
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {loading && <Spinner />}
 *       {error && <ErrorMessage>{error}</ErrorMessage>}
 *       {notifications.map(notification => (
 *         <NotificationItem
 *           key={notification._id}
 *           notification={notification}
 *           onMarkAsRead={() => handleMarkAsRead(notification._id)}
 *           onSnooze={() => handleSnooze(notification._id)}
 *           onDismiss={() => markAsDismissed(notification._id)}
 *           onDelete={() => deleteNotification(notification._id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * - All mutation operations (markAsRead, markAsDismissed, snoozeNotification, deleteNotification) use `offlineFetch` for offline support
 * - Mutations update local state optimistically before the server responds
 * - Real-time notifications are received via the event bus and automatically added to state
 * - The hook automatically prevents duplicate notifications from being added
 * - Automatically refetches notifications when reconnecting to network
 */
interface UseNotificationsOptions {
  initialNotifications?: Notification[];
}

export function useNotifications(
  initialNotificationsOrOptions?: Notification[] | UseNotificationsOptions,
): UseNotificationsReturn {
  // Support both array (legacy) and options object signatures
  const options =
    Array.isArray(initialNotificationsOrOptions) ||
    !initialNotificationsOrOptions
      ? { initialNotifications: initialNotificationsOrOptions ?? [] }
      : initialNotificationsOrOptions;
  const initialNotifications = options.initialNotifications ?? [];
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);
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
    [],
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
    setNotifications((prev) => prev.map((n) => (n._id === id ? updated : n)));
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
    setNotifications((prev) => prev.map((n) => (n._id === id ? updated : n)));
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
      setNotifications((prev) => prev.map((n) => (n._id === id ? updated : n)));
      return updated;
    },
    [],
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

  const dismissAll = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })));
    const res = await offlineFetch("/api/notifications", {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json();
      // Revert on failure would need original state; for now just throw
      throw new Error(body.error || "Failed to dismiss all notifications");
    }
  }, []);

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

      // Show desktop notification via service worker (or fallback Notification API)
      // whenever browser notification permission is granted
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SHOW_NOTIFICATION",
            title: event.title,
            body: event.message,
            tag: `pillar-${event.notificationId}`,
            data: {
              notificationId: event.notificationId,
              taskId: event.taskId,
              url: "/",
            },
          });
        } else {
          new Notification(event.title, {
            body: event.message,
            tag: `pillar-${event.notificationId}`,
            data: {
              notificationId: event.notificationId,
              taskId: event.taskId,
              url: "/",
            },
          });
        }
      }
    }

    window.addEventListener("pillar:notification", handler);
    return () => window.removeEventListener("pillar:notification", handler);
  }, []);

  useRefetchOnReconnect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
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
    dismissAll,
  };
}
