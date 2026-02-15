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
import { NotificationPreference } from "@/models/notification-preference";
import { POST } from "./route";

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

describe("/api/notifications/subscribe", () => {
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

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
            keys: {
              p256dh: "test-p256dh-key",
              auth: "test-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("creates subscription for user without existing preferences", async () => {
      const user = await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
            keys: {
              p256dh: "test-p256dh-key",
              auth: "test-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe(user._id.toString());
      expect(body.enableBrowserPush).toBe(true);
      expect(body.pushSubscription).toEqual({
        endpoint: "https://push.example.com/abc123",
        keys: {
          p256dh: "test-p256dh-key",
          auth: "test-auth-key",
        },
      });

      // Verify it was saved to DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved).toBeTruthy();
      expect(saved?.enableBrowserPush).toBe(true);
      expect(saved?.pushSubscription?.endpoint).toBe(
        "https://push.example.com/abc123",
      );
    });

    it("updates subscription for user with existing preferences", async () => {
      const user = await seedUser();

      // Create existing preferences
      await NotificationPreference.create({
        userId: user._id,
        enableBrowserPush: false,
        reminderTimings: [60],
      });

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/new-subscription",
            keys: {
              p256dh: "new-p256dh-key",
              auth: "new-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe(user._id.toString());
      expect(body.enableBrowserPush).toBe(true);
      expect(body.pushSubscription).toEqual({
        endpoint: "https://push.example.com/new-subscription",
        keys: {
          p256dh: "new-p256dh-key",
          auth: "new-auth-key",
        },
      });
      // Should keep existing preferences
      expect(body.reminderTimings).toEqual([60]);

      // Verify it was updated in DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved).toBeTruthy();
      expect(saved?.enableBrowserPush).toBe(true);
      expect(saved?.pushSubscription?.endpoint).toBe(
        "https://push.example.com/new-subscription",
      );
    });

    it("validates endpoint is a valid URL", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "not-a-url",
            keys: {
              p256dh: "test-p256dh-key",
              auth: "test-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("validates keys.p256dh is required", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
            keys: {
              auth: "test-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("validates keys.auth is required", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
            keys: {
              p256dh: "test-p256dh-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("validates endpoint is required", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            keys: {
              p256dh: "test-p256dh-key",
              auth: "test-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("validates keys is required", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("rejects empty p256dh key", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
            keys: {
              p256dh: "",
              auth: "test-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("rejects empty auth key", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
            keys: {
              p256dh: "test-p256dh-key",
              auth: "",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("replaces existing subscription with new one", async () => {
      const user = await seedUser();

      // Create existing preferences with old subscription
      await NotificationPreference.create({
        userId: user._id,
        enableBrowserPush: true,
        pushSubscription: {
          endpoint: "https://push.example.com/old-subscription",
          keys: {
            p256dh: "old-p256dh-key",
            auth: "old-auth-key",
          },
        },
      });

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/new-subscription",
            keys: {
              p256dh: "new-p256dh-key",
              auth: "new-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.pushSubscription).toEqual({
        endpoint: "https://push.example.com/new-subscription",
        keys: {
          p256dh: "new-p256dh-key",
          auth: "new-auth-key",
        },
      });

      // Verify old subscription was replaced in DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved?.pushSubscription?.endpoint).toBe(
        "https://push.example.com/new-subscription",
      );
      expect(saved?.pushSubscription?.keys.p256dh).toBe("new-p256dh-key");
      expect(saved?.pushSubscription?.keys.auth).toBe("new-auth-key");
    });

    it("preserves all other preferences when subscribing", async () => {
      const user = await seedUser();

      // Create existing preferences with custom settings
      await NotificationPreference.create({
        userId: user._id,
        enableBrowserPush: false,
        enableInAppNotifications: false,
        reminderTimings: [30, 10],
        enableEmailDigest: true,
        emailDigestFrequency: "weekly",
        quietHoursEnabled: true,
        quietHoursStart: "23:00",
        quietHoursEnd: "07:00",
        enableOverdueSummary: false,
      });

      const req = new NextRequest(
        "http://localhost/api/notifications/subscribe",
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://push.example.com/abc123",
            keys: {
              p256dh: "test-p256dh-key",
              auth: "test-auth-key",
            },
          }),
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      // Browser push should be enabled
      expect(body.enableBrowserPush).toBe(true);
      // All other preferences should be preserved
      expect(body.enableInAppNotifications).toBe(false);
      expect(body.reminderTimings).toEqual([30, 10]);
      expect(body.enableEmailDigest).toBe(true);
      expect(body.emailDigestFrequency).toBe("weekly");
      expect(body.quietHoursEnabled).toBe(true);
      expect(body.quietHoursStart).toBe("23:00");
      expect(body.quietHoursEnd).toBe("07:00");
      expect(body.enableOverdueSummary).toBe(false);
    });
  });
});
