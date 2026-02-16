import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNativePush } from "./use-native-push";

// Mock Capacitor detection
vi.mock("@/lib/capacitor", () => ({
  isNativePlatform: vi.fn(() => false),
  getNativePlatform: vi.fn(() => null),
}));

// Mock PushNotifications plugin
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockRegister = vi.fn();
const mockAddListener = vi.fn();
const mockRemoveAllListeners = vi.fn();

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: () => mockCheckPermissions(),
    requestPermissions: () => mockRequestPermissions(),
    register: () => mockRegister(),
    addListener: (...args: unknown[]) => mockAddListener(...args),
    removeAllListeners: () => mockRemoveAllListeners(),
  },
}));

describe("useNativePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) });
  });

  afterEach(() => {
    delete (window as Record<string, unknown>).Capacitor;
  });

  it("returns false from subscribe when not on native platform", async () => {
    const { result } = renderHook(() => useNativePush());

    let success: boolean;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success!).toBe(false);
    expect(mockCheckPermissions).not.toHaveBeenCalled();
  });

  it("subscribes successfully when permission is granted", async () => {
    const { isNativePlatform, getNativePlatform } = await import("@/lib/capacitor");
    (isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue("android");

    mockCheckPermissions.mockResolvedValue({ receive: "granted" });
    mockRegister.mockResolvedValue(undefined);
    mockAddListener.mockResolvedValue({ remove: vi.fn() });

    const { result } = renderHook(() => useNativePush());

    let success: boolean;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success!).toBe(true);
    expect(mockRegister).toHaveBeenCalled();
    expect(mockAddListener).toHaveBeenCalledWith("registration", expect.any(Function));
    expect(mockAddListener).toHaveBeenCalledWith("registrationError", expect.any(Function));
    expect(mockAddListener).toHaveBeenCalledWith("pushNotificationActionPerformed", expect.any(Function));
  });

  it("requests permission when status is prompt", async () => {
    const { isNativePlatform } = await import("@/lib/capacitor");
    (isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);

    mockCheckPermissions.mockResolvedValue({ receive: "prompt" });
    mockRequestPermissions.mockResolvedValue({ receive: "granted" });
    mockRegister.mockResolvedValue(undefined);
    mockAddListener.mockResolvedValue({ remove: vi.fn() });

    const { result } = renderHook(() => useNativePush());

    let success: boolean;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success!).toBe(true);
    expect(mockRequestPermissions).toHaveBeenCalled();
  });

  it("returns false when permission is denied", async () => {
    const { isNativePlatform } = await import("@/lib/capacitor");
    (isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);

    mockCheckPermissions.mockResolvedValue({ receive: "prompt" });
    mockRequestPermissions.mockResolvedValue({ receive: "denied" });

    const { result } = renderHook(() => useNativePush());

    let success: boolean;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe("Push notification permission denied");
  });

  it("does not register listeners twice", async () => {
    const { isNativePlatform } = await import("@/lib/capacitor");
    (isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);

    mockCheckPermissions.mockResolvedValue({ receive: "granted" });
    mockRegister.mockResolvedValue(undefined);
    mockAddListener.mockResolvedValue({ remove: vi.fn() });

    const { result } = renderHook(() => useNativePush());

    await act(async () => {
      await result.current.subscribe();
    });
    await act(async () => {
      await result.current.subscribe();
    });

    // addListener should only be called 3 times (once per event type)
    expect(mockAddListener).toHaveBeenCalledTimes(3);
  });

  it("unsubscribe removes all listeners", async () => {
    const { isNativePlatform } = await import("@/lib/capacitor");
    (isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);

    mockRemoveAllListeners.mockResolvedValue(undefined);

    const { result } = renderHook(() => useNativePush());

    let success: boolean;
    await act(async () => {
      success = await result.current.unsubscribe();
    });

    expect(success!).toBe(true);
    expect(mockRemoveAllListeners).toHaveBeenCalled();
  });

  it("returns false from unsubscribe when not on native platform", async () => {
    const { isNativePlatform } = await import("@/lib/capacitor");
    (isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { result } = renderHook(() => useNativePush());

    let success: boolean;
    await act(async () => {
      success = await result.current.unsubscribe();
    });

    expect(success!).toBe(false);
  });
});
