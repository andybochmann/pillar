import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncEventBus, emitSyncEvent, type SyncEvent } from "./event-bus";

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
});
