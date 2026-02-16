import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useNotificationPermission", () => {
  it("returns 'default' and requests permission when status is default", async () => {
    const requestMock = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: requestMock,
    });

    const { useNotificationPermission } = await import(
      "./use-notification-permission"
    );
    const { result } = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe("default");
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it("returns 'granted' without requesting when already granted", async () => {
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(),
    });

    const { useNotificationPermission } = await import(
      "./use-notification-permission"
    );
    const { result } = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe("granted");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("returns 'denied' without requesting when denied", async () => {
    vi.stubGlobal("Notification", {
      permission: "denied",
      requestPermission: vi.fn(),
    });

    const { useNotificationPermission } = await import(
      "./use-notification-permission"
    );
    const { result } = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe("denied");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("handles missing Notification API gracefully (SSR)", async () => {
    vi.stubGlobal("Notification", undefined);

    const { useNotificationPermission } = await import(
      "./use-notification-permission"
    );
    const { result } = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe("default");
  });
});
