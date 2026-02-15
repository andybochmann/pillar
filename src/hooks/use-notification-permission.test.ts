import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotificationPermission } from "./use-notification-permission";

describe("useNotificationPermission", () => {
  let originalNotification: typeof Notification | undefined;
  let mockPermission: NotificationPermission;
  let mockRequestPermission: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalNotification = (global as unknown as { Notification?: typeof Notification }).Notification;
    mockPermission = "default";
    mockRequestPermission = vi.fn(async () => mockPermission);

    // Mock Notification API
    Object.defineProperty(global, "Notification", {
      value: {
        get permission() {
          return mockPermission;
        },
        requestPermission: mockRequestPermission,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalNotification) {
      Object.defineProperty(global, "Notification", {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    } else {
      delete (global as unknown as { Notification?: typeof Notification }).Notification;
    }
  });

  it("returns 'default' permission initially", () => {
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.permission).toBe("default");
    expect(result.current.isSupported).toBe(true);
  });

  it("returns 'granted' when permission is granted", () => {
    mockPermission = "granted";
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.permission).toBe("granted");
  });

  it("returns 'denied' when permission is denied", () => {
    mockPermission = "denied";
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.permission).toBe("denied");
  });

  it("returns isSupported as true when Notification API is available", () => {
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.isSupported).toBe(true);
  });

  it("returns isSupported as false when Notification API is not available", () => {
    delete (global as unknown as { Notification?: typeof Notification }).Notification;
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.permission).toBe("default");
  });

  it("updates when visibility changes and permission was changed", () => {
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.permission).toBe("default");

    act(() => {
      mockPermission = "granted";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.permission).toBe("granted");
  });

  it("requestPermission calls Notification.requestPermission", async () => {
    mockPermission = "default";
    mockRequestPermission.mockResolvedValue("granted");

    const { result } = renderHook(() => useNotificationPermission());

    let permissionResult: NotificationPermission | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission();
    });

    expect(mockRequestPermission).toHaveBeenCalled();
    expect(permissionResult).toBe("granted");
  });

  it("requestPermission returns 'granted' immediately if already granted", async () => {
    mockPermission = "granted";
    mockRequestPermission.mockClear();

    const { result } = renderHook(() => useNotificationPermission());

    let permissionResult: NotificationPermission | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission();
    });

    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(permissionResult).toBe("granted");
  });

  it("requestPermission returns 'denied' when user denies", async () => {
    mockRequestPermission.mockResolvedValue("denied");
    mockPermission = "denied";

    const { result } = renderHook(() => useNotificationPermission());

    let permissionResult: NotificationPermission | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission();
    });

    expect(mockRequestPermission).toHaveBeenCalled();
    expect(permissionResult).toBe("denied");
  });

  it("requestPermission returns 'default' when Notification API is not available", async () => {
    delete (global as unknown as { Notification?: typeof Notification }).Notification;

    const { result } = renderHook(() => useNotificationPermission());

    let permissionResult: NotificationPermission | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission();
    });

    expect(permissionResult).toBe("default");
  });

  it("handles multiple visibility changes", () => {
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.permission).toBe("default");

    act(() => {
      mockPermission = "granted";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.permission).toBe("granted");

    act(() => {
      mockPermission = "denied";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.permission).toBe("denied");

    act(() => {
      mockPermission = "default";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.permission).toBe("default");
  });
});
