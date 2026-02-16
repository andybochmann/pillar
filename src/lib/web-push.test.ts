import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, createTestUser, createTestPushSubscription } from "@/test/helpers";
import { PushSubscription } from "@/models/push-subscription";

// Mock web-push module
const mockSendNotification = vi.fn();
const mockSetVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
  },
}));

// Mock firebase-admin module
const mockSendFcmNotification = vi.fn();
const mockIsFirebaseConfigured = vi.fn(() => false);
vi.mock("@/lib/firebase-admin", () => ({
  isFirebaseConfigured: () => mockIsFirebaseConfigured(),
  sendFcmNotification: (...args: unknown[]) => mockSendFcmNotification(...args),
}));

// Store original env
const originalEnv = { ...process.env };

describe("web-push helpers", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    const user = await createTestUser();
    userId = user._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await PushSubscription.deleteMany({});
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe("isWebPushConfigured", () => {
    it("returns false when VAPID env vars are not set", async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;

      vi.resetModules();
      const { isWebPushConfigured } = await import("@/lib/web-push");
      expect(isWebPushConfigured()).toBe(false);
    });

    it("returns true when all VAPID env vars are set", async () => {
      process.env.VAPID_PUBLIC_KEY = "test-public-key";
      process.env.VAPID_PRIVATE_KEY = "test-private-key";
      process.env.VAPID_SUBJECT = "mailto:test@example.com";

      vi.resetModules();
      const { isWebPushConfigured } = await import("@/lib/web-push");
      expect(isWebPushConfigured()).toBe(true);
    });

    it("returns false when only some VAPID vars are set", async () => {
      process.env.VAPID_PUBLIC_KEY = "test-public-key";
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;

      vi.resetModules();
      const { isWebPushConfigured } = await import("@/lib/web-push");
      expect(isWebPushConfigured()).toBe(false);
    });
  });

  describe("getVapidPublicKey", () => {
    it("returns the VAPID public key", async () => {
      process.env.VAPID_PUBLIC_KEY = "my-public-key";

      vi.resetModules();
      const { getVapidPublicKey } = await import("@/lib/web-push");
      expect(getVapidPublicKey()).toBe("my-public-key");
    });

    it("returns empty string when not set", async () => {
      delete process.env.VAPID_PUBLIC_KEY;

      vi.resetModules();
      const { getVapidPublicKey } = await import("@/lib/web-push");
      expect(getVapidPublicKey()).toBe("");
    });
  });

  describe("sendPushToUser", () => {
    beforeEach(() => {
      process.env.VAPID_PUBLIC_KEY = "test-public-key";
      process.env.VAPID_PRIVATE_KEY = "test-private-key";
      process.env.VAPID_SUBJECT = "mailto:test@example.com";
    });

    it("returns 0 when neither web push nor FCM is configured", async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
      mockIsFirebaseConfigured.mockReturnValue(false);

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Hello",
      });
      expect(count).toBe(0);
      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockSendFcmNotification).not.toHaveBeenCalled();
    });

    it("returns 0 when user has no subscriptions", async () => {
      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Hello",
      });
      expect(count).toBe(0);
    });

    it("sends push to all web subscriptions", async () => {
      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/device1",
      });
      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/device2",
      });

      mockSendNotification.mockResolvedValue({});

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Reminder",
        message: "Task needs attention",
        notificationId: "notif-123",
      });

      expect(count).toBe(2);
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it("sends push to native subscriptions via FCM", async () => {
      mockIsFirebaseConfigured.mockReturnValue(true);
      mockSendFcmNotification.mockResolvedValue(true);

      await createTestPushSubscription({
        userId,
        platform: "android",
        deviceToken: "native-token-1",
      });
      await createTestPushSubscription({
        userId,
        platform: "android",
        deviceToken: "native-token-2",
      });

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Reminder",
        message: "Task is due",
      });

      expect(count).toBe(2);
      expect(mockSendFcmNotification).toHaveBeenCalledTimes(2);
      expect(mockSendFcmNotification).toHaveBeenCalledWith(
        "native-token-1",
        expect.objectContaining({ title: "Reminder", message: "Task is due" }),
      );
    });

    it("sends to both web and native subscriptions", async () => {
      mockIsFirebaseConfigured.mockReturnValue(true);
      mockSendNotification.mockResolvedValue({});
      mockSendFcmNotification.mockResolvedValue(true);

      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/web-device",
      });
      await createTestPushSubscription({
        userId,
        platform: "android",
        deviceToken: "android-token",
      });

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Both platforms",
      });

      expect(count).toBe(2);
      expect(mockSendNotification).toHaveBeenCalledTimes(1);
      expect(mockSendFcmNotification).toHaveBeenCalledTimes(1);
    });

    it("sends only FCM when VAPID is not configured but Firebase is", async () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
      mockIsFirebaseConfigured.mockReturnValue(true);
      mockSendFcmNotification.mockResolvedValue(true);

      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/web-only",
      });
      await createTestPushSubscription({
        userId,
        platform: "android",
        deviceToken: "native-only-token",
      });

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "FCM only",
      });

      // Only the native sub should succeed (web push not configured)
      expect(count).toBe(1);
      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockSendFcmNotification).toHaveBeenCalledTimes(1);
    });

    it("deletes web subscription on 410 Gone", async () => {
      const sub = await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/expired",
      });

      const error = new Error("Gone") as Error & { statusCode: number };
      error.statusCode = 410;
      mockSendNotification.mockRejectedValue(error);

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Hello",
      });

      expect(count).toBe(0);
      const remaining = await PushSubscription.findById(sub._id);
      expect(remaining).toBeNull();
    });

    it("deletes web subscription on 404 Not Found", async () => {
      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/not-found",
      });

      const error = new Error("Not Found") as Error & { statusCode: number };
      error.statusCode = 404;
      mockSendNotification.mockRejectedValue(error);

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Hello",
      });

      expect(count).toBe(0);
      const remaining = await PushSubscription.find({ userId });
      expect(remaining).toHaveLength(0);
    });

    it("deletes native subscription on token-not-registered error", async () => {
      mockIsFirebaseConfigured.mockReturnValue(true);
      const sub = await createTestPushSubscription({
        userId,
        platform: "android",
        deviceToken: "expired-token",
      });

      const error = new Error("Token not registered") as Error & { code: string };
      error.code = "messaging/registration-token-not-registered";
      mockSendFcmNotification.mockRejectedValue(error);

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Hello",
      });

      expect(count).toBe(0);
      const remaining = await PushSubscription.findById(sub._id);
      expect(remaining).toBeNull();
    });

    it("does not delete subscription on other errors", async () => {
      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/server-error",
      });

      const error = new Error("Server Error") as Error & { statusCode: number };
      error.statusCode = 500;
      mockSendNotification.mockRejectedValue(error);

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Hello",
      });

      expect(count).toBe(0);
      const remaining = await PushSubscription.find({ userId });
      expect(remaining).toHaveLength(1);
    });

    it("partial failure still counts successes", async () => {
      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/good",
      });
      await createTestPushSubscription({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/bad",
      });

      mockSendNotification
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("Failed"));

      vi.resetModules();
      const { sendPushToUser } = await import("@/lib/web-push");

      const count = await sendPushToUser(userId.toString(), {
        title: "Test",
        message: "Hello",
      });

      expect(count).toBe(1);
    });
  });
});
