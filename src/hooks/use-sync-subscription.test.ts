import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSyncSubscription } from "./use-sync-subscription";
import type { SyncEvent } from "@/lib/event-bus";

describe("useSyncSubscription", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls handler when matching entity event fires", () => {
    const handler = vi.fn();
    renderHook(() => useSyncSubscription("task", handler));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: {
            entity: "task",
            action: "created",
            entityId: "task-1",
            data: { title: "Test" },
          } satisfies Partial<SyncEvent>,
        }),
      );
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "task",
        action: "created",
        entityId: "task-1",
      }),
    );
  });

  it("ignores events for different entity types", () => {
    const handler = vi.fn();
    renderHook(() => useSyncSubscription("task", handler));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: {
            entity: "project",
            action: "created",
            entityId: "project-1",
          } satisfies Partial<SyncEvent>,
        }),
      );
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useSyncSubscription("task", handler),
    );

    unmount();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: {
            entity: "task",
            action: "created",
            entityId: "task-1",
          } satisfies Partial<SyncEvent>,
        }),
      );
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("receives all action types for the matching entity", () => {
    const handler = vi.fn();
    renderHook(() => useSyncSubscription("project", handler));

    const actions = ["created", "updated", "deleted"] as const;
    actions.forEach((action) => {
      act(() => {
        window.dispatchEvent(
          new CustomEvent("pillar:sync", {
            detail: {
              entity: "project",
              action,
              entityId: "project-1",
            } satisfies Partial<SyncEvent>,
          }),
        );
      });
    });

    expect(handler).toHaveBeenCalledTimes(3);
  });
});
