import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePushSubscription } from "./use-push-subscription";

const mockSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
  toJSON: () => ({
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    keys: { p256dh: "test-p256dh", auth: "test-auth" },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

const mockPushManager = {
  subscribe: vi.fn().mockResolvedValue(mockSubscription),
  getSubscription: vi.fn().mockResolvedValue(mockSubscription),
};

const mockRegistration = {
  pushManager: mockPushManager,
};

beforeEach(() => {
  vi.clearAllMocks();

  // Mock service worker
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      ready: Promise.resolve(mockRegistration),
    },
    writable: true,
    configurable: true,
  });

  // Mock fetch
  global.fetch = vi.fn();
});

describe("usePushSubscription", () => {
  describe("subscribe", () => {
    it("fetches VAPID key, subscribes via push manager, and saves to server", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ publicKey: "BPk-test-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ _id: "sub-123", endpoint: "https://fcm..." }),
        });

      const { result } = renderHook(() => usePushSubscription());

      let success: boolean;
      await act(async () => {
        success = await result.current.subscribe();
      });

      expect(success!).toBe(true);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });
    });

    it("returns false and sets error when VAPID key not configured (503)", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: "Not configured" }),
      });

      const { result } = renderHook(() => usePushSubscription());

      let success: boolean;
      await act(async () => {
        success = await result.current.subscribe();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toContain("not configured");
    });

    it("returns false and sets error on server failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ publicKey: "BPk-test-key" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: "Server error" }),
        });

      const { result } = renderHook(() => usePushSubscription());

      let success: boolean;
      await act(async () => {
        success = await result.current.subscribe();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Server error");
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribes from push manager and deletes from server", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => usePushSubscription());

      let success: boolean;
      await act(async () => {
        success = await result.current.unsubscribe();
      });

      expect(success!).toBe(true);
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        }),
      });
    });

    it("succeeds even when no subscription exists", async () => {
      mockPushManager.getSubscription.mockResolvedValueOnce(null);

      const { result } = renderHook(() => usePushSubscription());

      let success: boolean;
      await act(async () => {
        success = await result.current.unsubscribe();
      });

      expect(success!).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
