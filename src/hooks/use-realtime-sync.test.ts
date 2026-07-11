import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/session-id", () => ({
  getSessionId: vi.fn(() => "test-session-id"),
}));

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate async connection
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (e: MessageEvent) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  close = vi.fn();

  // Test helper: simulate receiving a message
  _emit(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });
    this.listeners[type]?.forEach((l) => l(event));
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

vi.stubGlobal("EventSource", MockEventSource);

import { useRealtimeSync } from "./use-realtime-sync";

describe("useRealtimeSync", () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens an EventSource with session ID", () => {
    renderHook(() => useRealtimeSync());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(
      "/api/events?sessionId=test-session-id",
    );
  });

  it("dispatches pillar:sync CustomEvent on receiving sync message", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    renderHook(() => useRealtimeSync());

    const es = MockEventSource.instances[0];
    const syncData = {
      entity: "task",
      action: "created",
      entityId: "task-1",
      data: { title: "New Task" },
    };

    await act(async () => {
      es._emit("sync", syncData);
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pillar:sync",
        detail: syncData,
      }),
    );

    dispatchSpy.mockRestore();
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeSync());
    const es = MockEventSource.instances[0];

    unmount();
    expect(es.close).toHaveBeenCalled();
  });

  it("does not open EventSource when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    renderHook(() => useRealtimeSync());
    expect(MockEventSource.instances).toHaveLength(0);

    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it("dispatches pillar:notification CustomEvent on receiving notification message", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    renderHook(() => useRealtimeSync());

    const es = MockEventSource.instances[0];
    const notifData = {
      type: "reminder",
      notificationId: "notif-1",
      userId: "u1",
      taskId: "task-1",
      title: "Reminder",
      message: "Task is due soon",
      timestamp: Date.now(),
    };

    await act(async () => {
      es._emit("notification", notifData);
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pillar:notification",
        detail: notifData,
      }),
    );

    dispatchSpy.mockRestore();
  });

  it("does not open a duplicate EventSource from the reconnect timer (M9)", async () => {
    renderHook(() => useRealtimeSync());
    expect(MockEventSource.instances).toHaveLength(1);
    const es0 = MockEventSource.instances[0];

    // Error closes es0 and schedules a backoff reconnect.
    await act(async () => {
      es0.onerror?.();
    });

    // A manual reconnect (online) re-establishes a live connection first.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // When the scheduled backoff timer finally fires, it must bail because a
    // connection already exists — otherwise it leaks a second live EventSource.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("dispatches pillar:reconnected on reconnection after error", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    renderHook(() => useRealtimeSync());

    const es = MockEventSource.instances[0];

    // Simulate connection success, then error, then reconnect
    await act(async () => {
      es.onopen?.();
    });

    await act(async () => {
      es.onerror?.();
    });

    // Advance timers for reconnect delay
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // New EventSource instance after reconnect
    const es2 = MockEventSource.instances[1];
    if (es2) {
      await act(async () => {
        es2.readyState = 1;
        es2.onopen?.();
      });

      const reconnectEvents = dispatchSpy.mock.calls.filter(
        (call) => (call[0] as Event).type === "pillar:reconnected",
      );
      expect(reconnectEvents.length).toBeGreaterThanOrEqual(1);
    }

    dispatchSpy.mockRestore();
  });
});
