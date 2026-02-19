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

const mockRecalculate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/reminder-scheduler", () => ({
  recalculateRemindersForUser: mockRecalculate,
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
      expect(body.enableInAppNotifications).toBe(true);
      expect(body.quietHoursEnabled).toBe(false);
      expect(body.quietHoursStart).toBe("22:00");
      expect(body.quietHoursEnd).toBe("08:00");
      expect(body.enableOverdueSummary).toBe(true);
      expect(body.enableDailySummary).toBe(true);
      expect(body.dailySummaryTime).toBe("09:00");
      expect(body.enableBrowserPush).toBe(false);
      expect(body.dueDateReminders).toEqual([
        { daysBefore: 1, time: "09:00" },
        { daysBefore: 0, time: "08:00" },
      ]);
      expect(body.timezone).toBe("UTC");
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
        enableInAppNotifications: true,
        quietHoursEnabled: true,
        quietHoursStart: "23:00",
        quietHoursEnd: "07:00",
        enableOverdueSummary: false,
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.enableInAppNotifications).toBe(true);
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
          body: JSON.stringify({ enableInAppNotifications: false }),
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
            enableInAppNotifications: false,
            quietHoursEnabled: true,
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.enableInAppNotifications).toBe(false);
      expect(body.quietHoursEnabled).toBe(true);
      // Should keep default for unchanged fields
      expect(body.enableOverdueSummary).toBe(true);
    });

    it("creates preferences if none exist (upsert)", async () => {
      const user = await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            enableInAppNotifications: false,
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe(user._id.toString());
      expect(body.enableInAppNotifications).toBe(false);

      // Verify it was created in DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved).toBeTruthy();
      expect(saved?.enableInAppNotifications).toBe(false);
    });

    it("persists enableBrowserPush", async () => {
      const user = await seedUser();

      await NotificationPreference.create({ userId: user._id });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({ enableBrowserPush: true }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.enableBrowserPush).toBe(true);

      // Verify persisted in DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved?.enableBrowserPush).toBe(true);
    });

    it("persists dueDateReminders", async () => {
      const user = await seedUser();

      await NotificationPreference.create({ userId: user._id });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            dueDateReminders: [
              { daysBefore: 2, time: "10:00" },
              { daysBefore: 0, time: "20:00" },
            ],
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.dueDateReminders).toEqual([
        { daysBefore: 2, time: "10:00" },
        { daysBefore: 0, time: "20:00" },
      ]);

      // Verify persisted in DB
      const saved = await NotificationPreference.findOne({ userId: user._id });
      expect(saved?.dueDateReminders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ daysBefore: 2, time: "10:00" }),
          expect.objectContaining({ daysBefore: 0, time: "20:00" }),
        ]),
      );
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

    it("updates daily summary fields", async () => {
      const user = await seedUser();

      await NotificationPreference.create({ userId: user._id });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            enableDailySummary: false,
            dailySummaryTime: "08:30",
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.enableDailySummary).toBe(false);
      expect(body.dailySummaryTime).toBe("08:30");
    });

    it("validates dailySummaryTime format", async () => {
      await seedUser();

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            dailySummaryTime: "25:00",
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("HH:mm");
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
            enableInAppNotifications: false,
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
      expect(body.enableInAppNotifications).toBe(false);
      expect(body.quietHoursEnabled).toBe(true);
      expect(body.quietHoursStart).toBe("22:30");
      expect(body.quietHoursEnd).toBe("08:30");
      expect(body.enableOverdueSummary).toBe(false);
    });

    it("triggers recalculateRemindersForUser when dueDateReminders change", async () => {
      const user = await seedUser();
      mockRecalculate.mockClear();

      await NotificationPreference.create({ userId: user._id });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            dueDateReminders: [{ daysBefore: 2, time: "10:00" }],
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      // Give the fire-and-forget promise a tick to resolve
      await new Promise((r) => setTimeout(r, 10));
      expect(mockRecalculate).toHaveBeenCalledWith(user._id.toString());
    });

    it("triggers recalculateRemindersForUser when only timezone changes", async () => {
      const user = await seedUser();
      mockRecalculate.mockClear();

      await NotificationPreference.create({ userId: user._id });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            timezone: "America/New_York",
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 10));
      expect(mockRecalculate).toHaveBeenCalledWith(user._id.toString());
    });

    it("does NOT trigger recalculateRemindersForUser for unrelated changes", async () => {
      const user = await seedUser();
      mockRecalculate.mockClear();

      await NotificationPreference.create({ userId: user._id });

      const req = new NextRequest(
        "http://localhost/api/notifications/preferences",
        {
          method: "PATCH",
          body: JSON.stringify({
            enableInAppNotifications: false,
          }),
        },
      );

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 10));
      expect(mockRecalculate).not.toHaveBeenCalled();
    });
  });
});
