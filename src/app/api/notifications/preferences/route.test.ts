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
import { GET, PATCH } from "./route";

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

describe("/api/notifications/preferences", () => {
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

  describe("GET", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await GET();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("creates and returns default preferences if none exist", async () => {
      const user = await seedUser();

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe(user._id.toString());
      expect(body.enableBrowserPush).toBe(false);
      expect(body.enableInAppNotifications).toBe(true);
      expect(body.reminderTimings).toEqual([1440, 60, 15]);
      expect(body.enableEmailDigest).toBe(false);
      expect(body.emailDigestFrequency).toBe("none");
      expect(body.quietHoursEnabled).toBe(false);
      expect(body.quietHoursStart).toBe("22:00");
      expect(body.quietHoursEnd).toBe("08:00");
      expect(body.enableOverdueSummary).toBe(true);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();

      // Verify it was saved to DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved).toBeTruthy();
    });

    it("returns existing preferences", async () => {
      const user = await seedUser();

      // Create custom preferences
      await NotificationPreference.create({
        userId: user._id,
        enableBrowserPush: true,
        enableInAppNotifications: true,
        reminderTimings: [60, 15],
        enableEmailDigest: true,
        emailDigestFrequency: "daily",
        quietHoursEnabled: true,
        quietHoursStart: "23:00",
        quietHoursEnd: "07:00",
        enableOverdueSummary: false,
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.enableBrowserPush).toBe(true);
      expect(body.reminderTimings).toEqual([60, 15]);
      expect(body.emailDigestFrequency).toBe("daily");
      expect(body.quietHoursStart).toBe("23:00");
      expect(body.quietHoursEnd).toBe("07:00");
      expect(body.enableOverdueSummary).toBe(false);
    });
  });

  describe("PATCH", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({ enableBrowserPush: true }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("updates existing preferences", async () => {
      const user = await seedUser();

      // Create initial preferences
      await NotificationPreference.create({
        userId: user._id,
      });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            enableBrowserPush: true,
            reminderTimings: [30, 10],
            quietHoursEnabled: true,
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.enableBrowserPush).toBe(true);
      expect(body.reminderTimings).toEqual([30, 10]);
      expect(body.quietHoursEnabled).toBe(true);
      // Should keep default for unchanged fields
      expect(body.enableInAppNotifications).toBe(true);
      expect(body.emailDigestFrequency).toBe("none");
    });

    it("creates preferences if none exist (upsert)", async () => {
      const user = await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            enableBrowserPush: true,
            reminderTimings: [120],
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe(user._id.toString());
      expect(body.enableBrowserPush).toBe(true);
      expect(body.reminderTimings).toEqual([120]);

      // Verify it was created in DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved).toBeTruthy();
      expect(saved?.enableBrowserPush).toBe(true);
    });

    it("validates reminderTimings array", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            reminderTimings: [-10, 30], // negative value should fail
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("validates emailDigestFrequency enum", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            emailDigestFrequency: "invalid",
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("validates quietHoursStart format", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            quietHoursStart: "25:00", // invalid hour
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("HH:mm");
    });

    it("validates quietHoursEnd format", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            quietHoursEnd: "12:99", // invalid minutes
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("HH:mm");
    });

    it("accepts valid quiet hours format", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            quietHoursStart: "23:30",
            quietHoursEnd: "07:15",
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.quietHoursStart).toBe("23:30");
      expect(body.quietHoursEnd).toBe("07:15");
    });

    it("updates multiple fields at once", async () => {
      const user = await seedUser();

      await NotificationPreference.create({
        userId: user._id,
      });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            enableBrowserPush: true,
            enableInAppNotifications: true,
            reminderTimings: [60],
            enableEmailDigest: true,
            emailDigestFrequency: "weekly",
            quietHoursEnabled: true,
            quietHoursStart: "22:30",
            quietHoursEnd: "08:30",
            enableOverdueSummary: false,
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.enableBrowserPush).toBe(true);
      expect(body.enableInAppNotifications).toBe(true);
      expect(body.reminderTimings).toEqual([60]);
      expect(body.enableEmailDigest).toBe(true);
      expect(body.emailDigestFrequency).toBe("weekly");
      expect(body.quietHoursEnabled).toBe(true);
      expect(body.quietHoursStart).toBe("22:30");
      expect(body.quietHoursEnd).toBe("08:30");
      expect(body.enableOverdueSummary).toBe(false);
    });

    it("allows empty reminderTimings array", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            reminderTimings: [],
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.reminderTimings).toEqual([]);
    });

    it("rejects too many reminder timings", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            reminderTimings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // 11 items, max is 10
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });
});
