import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOfflineQueue } from "./use-offline-queue";
import { addToQueue, clearQueue } from "@/lib/offline-queue";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

/**
 * Build a Response whose `url` is set (real fetch populates this; the Response
 * constructor leaves it empty). The replayer inspects `res.url` to detect auth
 * redirects, so successful replays must present a same-origin /api/ url.
 */
function apiResponse(body: unknown = {}): Response {
  const res = new Response(JSON.stringify(body), { status: 200 });
  Object.defineProperty(res, "url", {
    value: "http://localhost/api/tasks",
    configurable: true,
  });
  return res;
}

describe("useOfflineQueue", () => {
  beforeEach(async () => {
    await clearQueue();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it("returns initial state", async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
      expect(result.current.queueCount).toBe(0);
      expect(result.current.syncing).toBe(false);
    });
  });

  it("reflects queue count", async () => {
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "A" },
    });
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "B" },
    });

    // Go offline so auto-sync doesn't fire
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queueCount).toBe(2);
    });
  });

  it("syncs when coming back online", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "queued" },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(apiResponse());

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queueCount).toBe(1);
    });

    // Go back online
    await act(async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.queueCount).toBe(0);
    });

    expect(fetchSpy).toHaveBeenCalled();
  });

  it("handles SYNC_COMPLETE message from service worker", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "queued" },
    });

    // Set up a mock SW container that supports addEventListener
    const swListeners: Record<string, ((event: MessageEvent) => void)[]> = {};
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
          if (!swListeners[event]) swListeners[event] = [];
          swListeners[event].push(handler);
        }),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queueCount).toBe(1);
    });

    // Clear the queue manually (simulating what the SW sync did)
    await clearQueue();

    // Simulate the SW sending SYNC_COMPLETE
    const messageHandlers = swListeners["message"] || [];
    await act(async () => {
      for (const handler of messageHandlers) {
        handler(new MessageEvent("message", { data: { type: "SYNC_COMPLETE" } }));
      }
    });

    await waitFor(() => {
      expect(result.current.queueCount).toBe(0);
    });
  });

  it("defers to Background Sync when SyncManager is available (Bug #5)", async () => {
    // Simulate a browser with Background Sync support
    Object.defineProperty(window, "SyncManager", {
      value: class {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "queued" },
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      apiResponse(),
    );

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queueCount).toBe(1);
    });

    // Go back online — with SyncManager available, app-level sync should NOT fire
    await act(async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    // Give it time to potentially fire
    await new Promise((r) => setTimeout(r, 50));

    // fetch should NOT have been called — Background Sync handles it
    expect(fetchSpy).not.toHaveBeenCalled();
    // Queue count should still be 1 (not replayed by app)
    expect(result.current.queueCount).toBe(1);

    // Clean up
    delete (window as Record<string, unknown>).SyncManager;
  });

  it("runs app-level sync when SyncManager is NOT available (Bug #5)", async () => {
    // Ensure SyncManager is NOT available
    delete (window as Record<string, unknown>).SyncManager;

    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "queued" },
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      apiResponse(),
    );

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queueCount).toBe(1);
    });

    // Go back online — without SyncManager, app-level sync SHOULD fire
    await act(async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.queueCount).toBe(0);
    });

    expect(fetchSpy).toHaveBeenCalled();
  });

  it("dispatches pillar:sync-complete after successful sync", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "queued" },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      apiResponse(),
    );

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.syncNow();
    });

    const syncCompleteEvents = dispatchSpy.mock.calls.filter(
      (call) => (call[0] as Event).type === "pillar:sync-complete",
    );
    expect(syncCompleteEvents).toHaveLength(1);

    dispatchSpy.mockRestore();
  });
});
