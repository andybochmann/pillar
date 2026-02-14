import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "./use-online-status";

describe("useOnlineStatus", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  it("returns true when online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it("returns false when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it("updates when going offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("updates when going back online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.isOnline).toBe(true);
  });
});
