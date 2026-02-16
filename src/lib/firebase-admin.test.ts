import { describe, it, expect, vi, afterEach } from "vitest";

const mockSend = vi.fn();
const mockGetMessaging = vi.fn(() => ({ send: mockSend }));
const mockCert = vi.fn(() => "mock-credential");
const mockGetApps = vi.fn(() => []);
const mockInitializeApp = vi.fn(() => "mock-app");

vi.mock("firebase-admin/app", () => ({
  cert: (...args: unknown[]) => mockCert(...args),
  getApps: () => mockGetApps(),
  initializeApp: (...args: unknown[]) => mockInitializeApp(...args),
}));

vi.mock("firebase-admin/messaging", () => ({
  getMessaging: (...args: unknown[]) => mockGetMessaging(...args),
}));

const originalEnv = { ...process.env };

describe("firebase-admin", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  describe("isFirebaseConfigured", () => {
    it("returns false when env var is not set", async () => {
      delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      const { isFirebaseConfigured } = await import("@/lib/firebase-admin");
      expect(isFirebaseConfigured()).toBe(false);
    });

    it("returns true when env var is set", async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = "dGVzdA==";
      const { isFirebaseConfigured } = await import("@/lib/firebase-admin");
      expect(isFirebaseConfigured()).toBe(true);
    });
  });

  describe("sendFcmNotification", () => {
    it("returns false when Firebase is not configured", async () => {
      delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      const { sendFcmNotification } = await import("@/lib/firebase-admin");

      const result = await sendFcmNotification("token123", {
        title: "Test",
        message: "Hello",
      });
      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("sends notification via FCM and returns true", async () => {
      const serviceAccount = JSON.stringify({
        project_id: "test-project",
        client_email: "test@test.iam.gserviceaccount.com",
        private_key: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----\n",
      });
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(serviceAccount).toString("base64");
      mockSend.mockResolvedValue("message-id");

      const { sendFcmNotification } = await import("@/lib/firebase-admin");

      const result = await sendFcmNotification("device-token-123", {
        title: "Task Reminder",
        message: "Your task is due soon",
        notificationId: "notif-1",
        taskId: "task-1",
        url: "/projects/abc",
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "device-token-123",
          notification: {
            title: "Task Reminder",
            body: "Your task is due soon",
          },
          data: {
            notificationId: "notif-1",
            taskId: "task-1",
            url: "/projects/abc",
          },
        }),
      );
    });

    it("omits undefined data fields from payload", async () => {
      const serviceAccount = JSON.stringify({ project_id: "test" });
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(serviceAccount).toString("base64");
      mockSend.mockResolvedValue("message-id");

      const { sendFcmNotification } = await import("@/lib/firebase-admin");

      await sendFcmNotification("token", {
        title: "Test",
        message: "No optional fields",
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.data).toEqual({});
    });

    it("reuses existing Firebase app", async () => {
      const serviceAccount = JSON.stringify({ project_id: "test" });
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(serviceAccount).toString("base64");
      mockGetApps.mockReturnValue(["existing-app"]);
      mockSend.mockResolvedValue("id");

      const { sendFcmNotification } = await import("@/lib/firebase-admin");

      await sendFcmNotification("token", { title: "T", message: "M" });

      expect(mockInitializeApp).not.toHaveBeenCalled();
      expect(mockGetMessaging).toHaveBeenCalledWith("existing-app");
    });

    it("propagates errors from messaging.send", async () => {
      const serviceAccount = JSON.stringify({ project_id: "test" });
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(serviceAccount).toString("base64");
      mockSend.mockRejectedValue(new Error("messaging/invalid-registration-token"));

      const { sendFcmNotification } = await import("@/lib/firebase-admin");

      await expect(
        sendFcmNotification("bad-token", { title: "T", message: "M" }),
      ).rejects.toThrow("messaging/invalid-registration-token");
    });
  });
});
