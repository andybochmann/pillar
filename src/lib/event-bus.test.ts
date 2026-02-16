import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  syncEventBus,
  emitSyncEvent,
  emitNotificationEvent,
  type SyncEvent,
  type NotificationEvent,
} from "./event-bus";

describe("event-bus", () => {
  beforeEach(() => {
    syncEventBus.removeAllListeners();
  });

  it("emits sync events to listeners", () => {
    const listener = vi.fn();
    syncEventBus.on("sync", listener);

    const event: SyncEvent = {
      entity: "task",
      action: "created",
      userId: "user-1",
      sessionId: "session-1",
      entityId: "task-1",
      timestamp: Date.now(),
    };

    emitSyncEvent(event);
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("supports multiple listeners", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    syncEventBus.on("sync", listener1);
    syncEventBus.on("sync", listener2);

    const event: SyncEvent = {
      entity: "project",
      action: "updated",
      userId: "user-1",
      sessionId: "session-1",
      entityId: "project-1",
      timestamp: Date.now(),
    };

    emitSyncEvent(event);
    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);
  });

  it("includes optional data and projectId", () => {
    const listener = vi.fn();
    syncEventBus.on("sync", listener);

    const event: SyncEvent = {
      entity: "task",
      action: "created",
      userId: "user-1",
      sessionId: "session-1",
      entityId: "task-1",
      projectId: "project-1",
      data: { title: "Test Task" },
      timestamp: Date.now(),
    };

    emitSyncEvent(event);
    expect(listener).toHaveBeenCalledWith(event);
    expect(listener.mock.calls[0][0].projectId).toBe("project-1");
    expect(listener.mock.calls[0][0].data).toEqual({ title: "Test Task" });
  });

  it("supports all entity types", () => {
    const listener = vi.fn();
    syncEventBus.on("sync", listener);

    const entities = ["task", "project", "category", "label"] as const;
    entities.forEach((entity) => {
      emitSyncEvent({
        entity,
        action: "created",
        userId: "user-1",
        sessionId: "session-1",
        entityId: `${entity}-1`,
        timestamp: Date.now(),
      });
    });

    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("supports all action types", () => {
    const listener = vi.fn();
    syncEventBus.on("sync", listener);

    const actions = ["created", "updated", "deleted", "reordered"] as const;
    actions.forEach((action) => {
      emitSyncEvent({
        entity: "task",
        action,
        userId: "user-1",
        sessionId: "session-1",
        entityId: "task-1",
        timestamp: Date.now(),
      });
    });

    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("has high max listeners to support many SSE connections", () => {
    expect(syncEventBus.getMaxListeners()).toBeGreaterThanOrEqual(200);
  });

  describe("notification events", () => {
    it("emits notification events to listeners", () => {
      const listener = vi.fn();
      syncEventBus.on("notification", listener);

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-1",
        userId: "user-1",
        taskId: "task-1",
        title: "Task due soon",
        message: "Your task is due in 1 hour",
        timestamp: Date.now(),
      };

      emitNotificationEvent(event);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it("supports multiple listeners for notifications", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      syncEventBus.on("notification", listener1);
      syncEventBus.on("notification", listener2);

      const event: NotificationEvent = {
        type: "overdue",
        notificationId: "notif-2",
        userId: "user-1",
        taskId: "task-2",
        title: "Task overdue",
        message: "Your task is overdue",
        timestamp: Date.now(),
      };

      emitNotificationEvent(event);
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it("includes optional metadata", () => {
      const listener = vi.fn();
      syncEventBus.on("notification", listener);

      const event: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-3",
        userId: "user-1",
        taskId: "task-3",
        title: "Reminder",
        message: "Don't forget your task",
        metadata: { priority: "high", projectId: "project-1" },
        timestamp: Date.now(),
      };

      emitNotificationEvent(event);
      expect(listener).toHaveBeenCalledWith(event);
      expect(listener.mock.calls[0][0].metadata).toEqual({
        priority: "high",
        projectId: "project-1",
      });
    });

    it("supports all notification types", () => {
      const listener = vi.fn();
      syncEventBus.on("notification", listener);

      const types = [
        "reminder",
        "overdue",
        "daily-summary",
      ] as const;
      types.forEach((type) => {
        emitNotificationEvent({
          type,
          notificationId: `notif-${type}`,
          userId: "user-1",
          ...(type !== "daily-summary" && { taskId: "task-1" }),
          title: `Notification ${type}`,
          message: `Message for ${type}`,
          timestamp: Date.now(),
        });
      });

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it("supports notification events without taskId (daily-summary)", () => {
      const listener = vi.fn();
      syncEventBus.on("notification", listener);

      const event: NotificationEvent = {
        type: "daily-summary",
        notificationId: "notif-ds",
        userId: "user-1",
        title: "Daily Summary",
        message: "You have 3 tasks due today",
        timestamp: Date.now(),
      };

      emitNotificationEvent(event);
      expect(listener).toHaveBeenCalledWith(event);
      expect(listener.mock.calls[0][0].taskId).toBeUndefined();
    });

    it("does not interfere with sync events", () => {
      const syncListener = vi.fn();
      const notifListener = vi.fn();
      syncEventBus.on("sync", syncListener);
      syncEventBus.on("notification", notifListener);

      const syncEvent: SyncEvent = {
        entity: "task",
        action: "created",
        userId: "user-1",
        sessionId: "session-1",
        entityId: "task-1",
        timestamp: Date.now(),
      };

      const notifEvent: NotificationEvent = {
        type: "reminder",
        notificationId: "notif-1",
        userId: "user-1",
        taskId: "task-1",
        title: "Task due soon",
        message: "Your task is due in 1 hour",
        timestamp: Date.now(),
      };

      emitSyncEvent(syncEvent);
      emitNotificationEvent(notifEvent);

      expect(syncListener).toHaveBeenCalledWith(syncEvent);
      expect(syncListener).not.toHaveBeenCalledWith(notifEvent);
      expect(notifListener).toHaveBeenCalledWith(notifEvent);
      expect(notifListener).not.toHaveBeenCalledWith(syncEvent);
    });
  });
});
