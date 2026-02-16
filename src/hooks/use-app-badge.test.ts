import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppBadge } from "./use-app-badge";

describe("useAppBadge", () => {
  const mockSetAppBadge = vi.fn().mockResolvedValue(undefined);
  const mockClearAppBadge = vi.fn().mockResolvedValue(undefined);
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockSetAppBadge.mockClear();
    mockClearAppBadge.mockClear();
    mockPostMessage.mockClear();

    // Mock navigator Badging API
    Object.defineProperty(navigator, "setAppBadge", {
      value: mockSetAppBadge,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clearAppBadge", {
      value: mockClearAppBadge,
      writable: true,
      configurable: true,
    });

    // Mock service worker
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        controller: {
          postMessage: mockPostMessage,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("calls setAppBadge with count when overdue tasks exist", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 5 }), { status: 200 }),
    );

    renderHook(() => useAppBadge());

    // Wait for async fetch + badge update
    await vi.advanceTimersByTimeAsync(100);

    expect(global.fetch).toHaveBeenCalledWith("/api/stats/overdue-count");
    expect(mockSetAppBadge).toHaveBeenCalledWith(5);
    expect(mockClearAppBadge).not.toHaveBeenCalled();
  });

  it("calls clearAppBadge when count is 0", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 0 }), { status: 200 }),
    );

    renderHook(() => useAppBadge());

    await vi.advanceTimersByTimeAsync(100);

    expect(mockClearAppBadge).toHaveBeenCalled();
    expect(mockSetAppBadge).not.toHaveBeenCalled();
  });

  it("no-ops gracefully when Badging API not available", async () => {
    // Remove Badging API
    Object.defineProperty(navigator, "setAppBadge", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clearAppBadge", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 3 }), { status: 200 }),
    );

    // Should not throw
    renderHook(() => useAppBadge());

    await vi.advanceTimersByTimeAsync(100);

    // fetch should not even be called when badging API is unavailable
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refetches on pillar:sync task event with debounce", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 2 }), { status: 200 }),
    );

    renderHook(() => useAppBadge());

    // Wait for initial fetch
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Dispatch a sync event for task entity
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: { entity: "task", action: "updated" },
        }),
      );
    });

    // Before debounce completes, should not have refetched
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // After debounce (2s total), should refetch
    await vi.advanceTimersByTimeAsync(1100);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not refetch on non-task sync events", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 0 }), { status: 200 }),
    );

    renderHook(() => useAppBadge());

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Dispatch sync event for non-task entity
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: { entity: "project", action: "updated" },
        }),
      );
    });

    await vi.advanceTimersByTimeAsync(3000);
    // Should still be only the initial fetch
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("refetches immediately on pillar:sync-complete", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 1 }), { status: 200 }),
    );

    renderHook(() => useAppBadge());

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("pillar:sync-complete"));
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("refetches immediately on pillar:reconnected", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 0 }), { status: 200 }),
    );

    renderHook(() => useAppBadge());

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("pillar:reconnected"));
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("sends UPDATE_BADGE message to service worker", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 3 }), { status: 200 }),
    );

    renderHook(() => useAppBadge());

    await vi.advanceTimersByTimeAsync(100);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "UPDATE_BADGE",
      count: 3,
    });
  });
});
