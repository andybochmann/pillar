import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { NotificationEvent } from "@/lib/event-bus";
import { useNotifications } from "./use-notifications";

const mockNotifications = [
  {
    _id: "notif-1",
    userId: "u1",
    taskId: "task-1",
    type: "due-soon" as const,
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
        type: "due-soon",
        taskId: "task-1",
        limit: 10,
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/notifications?read=false&dismissed=false&type=due-soon&taskId=task-1&limit=10"
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
        type: "daily-summary",
        notificationId: "notif-summary",
        userId: "u1",
        taskId: "task-1",
        title: "Daily Summary",
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
        type: "due-soon",
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
