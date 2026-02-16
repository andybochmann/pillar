import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { NotificationEvent } from "@/lib/event-bus";
import { useNotifications } from "./use-notifications";

const mockNotifications = [
  {
    _id: "notif-1",
    userId: "u1",
    taskId: "task-1",
    type: "reminder" as const,
    title: "Task due soon",
    message: "Task 'Fix login bug' is due in 1 hour",
    read: false,
    dismissed: false,
    createdAt: "2026-02-15T10:00:00.000Z",
    updatedAt: "2026-02-15T10:00:00.000Z",
  },
  {
    _id: "notif-2",
    userId: "u1",
    taskId: "task-2",
    type: "overdue" as const,
    title: "Task overdue",
    message: "Task 'Write tests' is overdue",
    read: true,
    dismissed: false,
    createdAt: "2026-02-14T10:00:00.000Z",
    updatedAt: "2026-02-14T10:00:00.000Z",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useNotifications", () => {
  it("initializes with provided notifications", () => {
    const { result } = renderHook(() => useNotifications(mockNotifications));
    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.loading).toBe(false);
  });

  it("initializes empty when no notifications provided", () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toEqual([]);
  });

  it("fetches notifications without params", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications,
    } as Response);

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(result.current.notifications).toEqual(mockNotifications);
    expect(global.fetch).toHaveBeenCalledWith("/api/notifications");
  });

  it("fetches notifications with query params", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [mockNotifications[0]],
    } as Response);

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.fetchNotifications({
        read: false,
        dismissed: false,
        type: "reminder",
        taskId: "task-1",
        limit: 10,
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/notifications?read=false&dismissed=false&type=reminder&taskId=task-1&limit=10"
    );
  });

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as Response);

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(result.current.error).toBe("Not found");
  });

  it("marks notification as read", async () => {
    const updated = { ...mockNotifications[0], read: true };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const { result } = renderHook(() => useNotifications(mockNotifications));

    await act(async () => {
      await result.current.markAsRead("notif-1");
    });

    expect(result.current.notifications[0].read).toBe(true);
  });

  it("marks notification as dismissed", async () => {
    const updated = { ...mockNotifications[0], dismissed: true };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const { result } = renderHook(() => useNotifications(mockNotifications));

    await act(async () => {
      await result.current.markAsDismissed("notif-1");
    });

    expect(result.current.notifications[0].dismissed).toBe(true);
  });

  it("snoozes notification", async () => {
    const snoozedUntil = "2026-02-16T10:00:00.000Z";
    const updated = { ...mockNotifications[0], snoozedUntil };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const { result } = renderHook(() => useNotifications(mockNotifications));

    await act(async () => {
      await result.current.snoozeNotification("notif-1", snoozedUntil);
    });

    expect(result.current.notifications[0].snoozedUntil).toBe(snoozedUntil);
  });

  it("deletes notification", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const { result } = renderHook(() => useNotifications(mockNotifications));

    await act(async () => {
      await result.current.deleteNotification("notif-1");
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]._id).toBe("notif-2");
  });

  it("throws on markAsRead failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as Response);

    const { result } = renderHook(() => useNotifications());

    await expect(
      act(() => result.current.markAsRead("notif-1"))
    ).rejects.toThrow("Not found");
  });

  it("dismisses all notifications optimistically", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, count: 1 }),
    } as Response);

    const { result } = renderHook(() => useNotifications(mockNotifications));

    await act(async () => {
      await result.current.dismissAll();
    });

    expect(result.current.notifications.every((n) => n.dismissed)).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({
      method: "DELETE",
    }));
  });

  it("throws on dismissAll failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    } as Response);

    const { result } = renderHook(() => useNotifications(mockNotifications));

    await expect(
      act(() => result.current.dismissAll())
    ).rejects.toThrow("Server error");
  });

  it("throws on markAsDismissed failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as Response);

    const { result } = renderHook(() => useNotifications());

    await expect(
      act(() => result.current.markAsDismissed("notif-1"))
    ).rejects.toThrow("Not found");
  });

  it("throws on snoozeNotification failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invalid date" }),
    } as Response);

    const { result } = renderHook(() => useNotifications());

    await expect(
      act(() =>
        result.current.snoozeNotification("notif-1", "invalid-date")
      )
    ).rejects.toThrow("Invalid date");
  });

  it("throws on deleteNotification failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as Response);

    const { result } = renderHook(() => useNotifications());

    await expect(
      act(() => result.current.deleteNotification("notif-1"))
    ).rejects.toThrow("Not found");
  });

  it("allows direct setNotifications for optimistic updates", () => {
    const { result } = renderHook(() => useNotifications(mockNotifications));

    act(() => {
      result.current.setNotifications((prev) =>
        prev.map((n) => (n._id === "notif-1" ? { ...n, read: true } : n))
      );
    });

    expect(result.current.notifications[0].read).toBe(true);
  });

  describe("notification events", () => {
    function emitNotification(detail: Partial<NotificationEvent>) {
      window.dispatchEvent(
        new CustomEvent("pillar:notification", { detail })
      );
    }

    it("adds notification on pillar:notification event", () => {
      const { result } = renderHook(() => useNotifications());

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-new",
        userId: "u1",
        taskId: "task-3",
        title: "Reminder",
        message: "Don't forget to do the thing",
        timestamp: Date.now(),
      };

      act(() => {
        emitNotification(event);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]._id).toBe("notif-new");
      expect(result.current.notifications[0].type).toBe("reminder");
      expect(result.current.notifications[0].read).toBe(false);
      expect(result.current.notifications[0].dismissed).toBe(false);
    });

    it("includes metadata in notification event", () => {
      const { result } = renderHook(() => useNotifications());

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-summary",
        userId: "u1",
        taskId: "task-1",
        title: "Task Reminder",
        message: "You have 5 tasks due today",
        metadata: { taskCount: 5, projectId: "proj-1" },
        timestamp: Date.now(),
      };

      act(() => {
        emitNotification(event);
      });

      expect(result.current.notifications[0].metadata).toEqual({
        taskCount: 5,
        projectId: "proj-1",
      });
    });

    it("does not add duplicate notifications", () => {
      const { result } = renderHook(() =>
        useNotifications(mockNotifications)
      );

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-1",
        userId: "u1",
        taskId: "task-1",
        title: "Task due soon",
        message: "Duplicate",
        timestamp: Date.now(),
      };

      act(() => {
        emitNotification(event);
      });

      expect(result.current.notifications).toHaveLength(2);
    });

    it("posts message to service worker when tab is not focused", () => {
      const postMessageMock = vi.fn();
      Object.defineProperty(navigator, "serviceWorker", {
        value: { controller: { postMessage: postMessageMock } },
        configurable: true,
        writable: true,
      });
      vi.stubGlobal("Notification", { permission: "granted" });
      vi.spyOn(document, "hasFocus").mockReturnValue(false);

      renderHook(() => useNotifications());

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-sw",
        userId: "u1",
        taskId: "task-sw",
        title: "SW Notification",
        message: "Test message",
        timestamp: Date.now(),
      };

      act(() => {
        emitNotification(event);
      });

      expect(postMessageMock).toHaveBeenCalledWith({
        type: "SHOW_NOTIFICATION",
        title: "SW Notification",
        body: "Test message",
        data: {
          notificationId: "notif-sw",
          taskId: "task-sw",
          url: "/",
        },
      });
    });

    it("does not post to service worker when tab is focused and enableBrowserPush is false", () => {
      const postMessageMock = vi.fn();
      Object.defineProperty(navigator, "serviceWorker", {
        value: { controller: { postMessage: postMessageMock } },
        configurable: true,
        writable: true,
      });
      vi.stubGlobal("Notification", { permission: "granted" });
      vi.spyOn(document, "hasFocus").mockReturnValue(true);

      renderHook(() => useNotifications());

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-focused",
        userId: "u1",
        title: "Focused",
        message: "Should not go to SW",
        timestamp: Date.now(),
      };

      act(() => {
        emitNotification(event);
      });

      expect(postMessageMock).not.toHaveBeenCalled();
    });

    it("posts to service worker when tab is focused but enableBrowserPush is true", () => {
      const postMessageMock = vi.fn();
      Object.defineProperty(navigator, "serviceWorker", {
        value: { controller: { postMessage: postMessageMock } },
        configurable: true,
        writable: true,
      });
      vi.stubGlobal("Notification", { permission: "granted" });
      vi.spyOn(document, "hasFocus").mockReturnValue(true);

      renderHook(() =>
        useNotifications({ enableBrowserPush: true })
      );

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-push-focused",
        userId: "u1",
        taskId: "task-push",
        title: "Push While Focused",
        message: "Should go to SW",
        timestamp: Date.now(),
      };

      act(() => {
        emitNotification(event);
      });

      expect(postMessageMock).toHaveBeenCalledWith({
        type: "SHOW_NOTIFICATION",
        title: "Push While Focused",
        body: "Should go to SW",
        data: {
          notificationId: "notif-push-focused",
          taskId: "task-push",
          url: "/",
        },
      });
    });

    it("does not post to service worker when permission is denied", () => {
      const postMessageMock = vi.fn();
      Object.defineProperty(navigator, "serviceWorker", {
        value: { controller: { postMessage: postMessageMock } },
        configurable: true,
        writable: true,
      });
      vi.stubGlobal("Notification", { permission: "denied" });
      vi.spyOn(document, "hasFocus").mockReturnValue(false);

      renderHook(() => useNotifications());

      act(() => {
        emitNotification({
          type: "reminder",
          notificationId: "notif-denied",
          userId: "u1",
          title: "Denied",
          message: "No SW",
          timestamp: Date.now(),
        });
      });

      expect(postMessageMock).not.toHaveBeenCalled();
    });

    it("does not post to service worker when no controller available", () => {
      Object.defineProperty(navigator, "serviceWorker", {
        value: { controller: null },
        configurable: true,
        writable: true,
      });
      vi.stubGlobal("Notification", { permission: "granted" });
      vi.spyOn(document, "hasFocus").mockReturnValue(false);

      renderHook(() => useNotifications());

      act(() => {
        emitNotification({
          type: "reminder",
          notificationId: "notif-no-ctrl",
          userId: "u1",
          title: "No Controller",
          message: "No SW",
          timestamp: Date.now(),
        });
      });

      // Should not throw, just silently skip
      expect(true).toBe(true);
    });

    it("prepends new notification to the list", () => {
      const { result } = renderHook(() =>
        useNotifications(mockNotifications)
      );

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-new",
        userId: "u1",
        taskId: "task-1",
        title: "New",
        message: "New notification",
        timestamp: Date.now(),
      };

      act(() => {
        emitNotification(event);
      });

      expect(result.current.notifications).toHaveLength(3);
      expect(result.current.notifications[0]._id).toBe("notif-new");
    });
  });

  describe("refetch on reconnect", () => {
    it("refetches on pillar:reconnected event", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockNotifications,
      } as Response);

      renderHook(() => useNotifications());

      await act(async () => {
        window.dispatchEvent(new CustomEvent("pillar:reconnected"));
      });

      expect(fetchSpy).toHaveBeenCalledWith("/api/notifications");
    });

    it("refetches on pillar:sync-complete event", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockNotifications,
      } as Response);

      renderHook(() => useNotifications());

      await act(async () => {
        window.dispatchEvent(new CustomEvent("pillar:sync-complete"));
      });

      expect(fetchSpy).toHaveBeenCalledWith("/api/notifications");
    });
  });
});
