import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
} from "@/test/helpers";
import { PushSubscription } from "@/models/push-subscription";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import { POST, DELETE } from "./route";

describe("/api/push/subscribe", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  async function seedUser() {
    const user = await createTestUser();
    session.user.id = user._id.toString();
    return user;
  }

  describe("POST", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/abc",
          keys: { p256dh: "key1", auth: "key2" },
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("creates a new subscription", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/new-device",
          keys: { p256dh: "p256dh-key", auth: "auth-key" },
          userAgent: "TestBrowser/1.0",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body._id).toBeDefined();
      expect(body.endpoint).toBe(
        "https://fcm.googleapis.com/fcm/send/new-device",
      );

      const stored = await PushSubscription.findById(body._id);
      expect(stored).not.toBeNull();
      expect(stored!.keys.p256dh).toBe("p256dh-key");
      expect(stored!.keys.auth).toBe("auth-key");
      expect(stored!.userAgent).toBe("TestBrowser/1.0");
    });

    it("upserts existing endpoint with new user", async () => {
      const user1 = await seedUser();

      // Create subscription for user1
      await PushSubscription.create({
        userId: user1._id,
        endpoint: "https://fcm.googleapis.com/fcm/send/shared-device",
        keys: { p256dh: "old-key", auth: "old-auth" },
      });

      // New user logs in on same browser
      const user2 = await createTestUser({ email: "user2@example.com" });
      session.user.id = user2._id.toString();

      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/shared-device",
          keys: { p256dh: "new-key", auth: "new-auth" },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      // Should be transferred to user2
      const subs = await PushSubscription.find({
        endpoint: "https://fcm.googleapis.com/fcm/send/shared-device",
      });
      expect(subs).toHaveLength(1);
      expect(subs[0].userId.toString()).toBe(user2._id.toString());
      expect(subs[0].keys.p256dh).toBe("new-key");
    });

    it("returns 400 for invalid endpoint", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "not-a-url",
          keys: { p256dh: "key", auth: "key" },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing keys", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        }),
      });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it("deletes a subscription by endpoint", async () => {
      const user = await seedUser();
      await PushSubscription.create({
        userId: user._id,
        endpoint: "https://fcm.googleapis.com/fcm/send/to-delete",
        keys: { p256dh: "key1", auth: "key2" },
      });

      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/to-delete",
        }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const remaining = await PushSubscription.find({ userId: user._id });
      expect(remaining).toHaveLength(0);
    });

    it("does not delete another user's subscription", async () => {
      await seedUser();
      const otherUser = await createTestUser({ email: "other@example.com" });
      await PushSubscription.create({
        userId: otherUser._id,
        endpoint: "https://fcm.googleapis.com/fcm/send/other-device",
        keys: { p256dh: "key1", auth: "key2" },
      });

      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/other-device",
        }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);

      // Other user's subscription should still exist
      const remaining = await PushSubscription.find({ userId: otherUser._id });
      expect(remaining).toHaveLength(1);
    });

    it("returns 400 for invalid endpoint", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify({ endpoint: "not-a-url" }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});
