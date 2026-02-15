import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers";
import { NotificationPreference } from "@/models/notification-preference";
import { User } from "@/models/user";
import mongoose from "mongoose";

describe("NotificationPreference Model", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  beforeEach(async () => {
    const user = await User.create({
      name: "Test User",
      email: "test@example.com",
      passwordHash: "hash",
    });
    userId = user._id;
  });

  it("creates notification preferences with default values", async () => {
    const pref = await NotificationPreference.create({
      userId,
    });

    expect(pref.userId.toString()).toBe(userId.toString());
    expect(pref.enableBrowserPush).toBe(false);
    expect(pref.enableInAppNotifications).toBe(true);
    expect(pref.reminderTimings).toEqual([1440, 60, 15]);
    expect(pref.enableEmailDigest).toBe(false);
    expect(pref.emailDigestFrequency).toBe("none");
    expect(pref.quietHoursEnabled).toBe(false);
    expect(pref.quietHoursStart).toBe("22:00");
    expect(pref.quietHoursEnd).toBe("08:00");
    expect(pref.enableOverdueSummary).toBe(true);
    expect(pref.pushSubscription).toBeUndefined();
    expect(pref.createdAt).toBeInstanceOf(Date);
    expect(pref.updatedAt).toBeInstanceOf(Date);
  });

  it("creates notification preferences with custom values", async () => {
    const pref = await NotificationPreference.create({
      userId,
      enableBrowserPush: true,
      enableInAppNotifications: false,
      reminderTimings: [60, 15],
      enableEmailDigest: true,
      emailDigestFrequency: "daily",
      quietHoursEnabled: true,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      enableOverdueSummary: false,
    });

    expect(pref.enableBrowserPush).toBe(true);
    expect(pref.enableInAppNotifications).toBe(false);
    expect(pref.reminderTimings).toEqual([60, 15]);
    expect(pref.enableEmailDigest).toBe(true);
    expect(pref.emailDigestFrequency).toBe("daily");
    expect(pref.quietHoursEnabled).toBe(true);
    expect(pref.quietHoursStart).toBe("23:00");
    expect(pref.quietHoursEnd).toBe("07:00");
    expect(pref.enableOverdueSummary).toBe(false);
  });

  it("requires userId field", async () => {
    await expect(NotificationPreference.create({})).rejects.toThrow(
      /userId.*required/i,
    );
  });

  it("enforces unique userId", async () => {
    await NotificationPreference.create({ userId });

    await expect(NotificationPreference.create({ userId })).rejects.toThrow();
  });

  it("validates reminderTimings are positive numbers", async () => {
    await expect(
      NotificationPreference.create({
        userId,
        reminderTimings: [60, -10, 15],
      }),
    ).rejects.toThrow(/All reminder timings must be positive numbers/i);
  });

  it("validates emailDigestFrequency enum", async () => {
    await expect(
      NotificationPreference.create({
        userId,
        emailDigestFrequency: "monthly" as "daily",
      }),
    ).rejects.toThrow();
  });

  it("validates quietHoursStart format", async () => {
    await expect(
      NotificationPreference.create({
        userId,
        quietHoursStart: "25:00",
      }),
    ).rejects.toThrow(/quietHoursStart must be in HH:mm format/i);

    await expect(
      NotificationPreference.create({
        userId,
        quietHoursStart: "22:70",
      }),
    ).rejects.toThrow(/quietHoursStart must be in HH:mm format/i);

    await expect(
      NotificationPreference.create({
        userId,
        quietHoursStart: "10pm",
      }),
    ).rejects.toThrow(/quietHoursStart must be in HH:mm format/i);
  });

  it("validates quietHoursEnd format", async () => {
    await expect(
      NotificationPreference.create({
        userId,
        quietHoursEnd: "24:00",
      }),
    ).rejects.toThrow(/quietHoursEnd must be in HH:mm format/i);

    await expect(
      NotificationPreference.create({
        userId,
        quietHoursEnd: "08:60",
      }),
    ).rejects.toThrow(/quietHoursEnd must be in HH:mm format/i);
  });

  it("accepts valid quietHours time formats", async () => {
    const pref = await NotificationPreference.create({
      userId,
      quietHoursStart: "00:00",
      quietHoursEnd: "23:59",
    });

    expect(pref.quietHoursStart).toBe("00:00");
    expect(pref.quietHoursEnd).toBe("23:59");
  });

  it("stores push subscription with all required fields", async () => {
    const pushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: {
        p256dh: "BDd3_hVL9fZi9Ybo",
        auth: "BTBZMqHH6r4Tts7J",
      },
    };

    const pref = await NotificationPreference.create({
      userId,
      enableBrowserPush: true,
      pushSubscription,
    });

    expect(pref.pushSubscription).toBeDefined();
    expect(pref.pushSubscription?.endpoint).toBe(pushSubscription.endpoint);
    expect(pref.pushSubscription?.keys.p256dh).toBe(
      pushSubscription.keys.p256dh,
    );
    expect(pref.pushSubscription?.keys.auth).toBe(pushSubscription.keys.auth);
  });

  it("allows updating notification preferences", async () => {
    const pref = await NotificationPreference.create({ userId });

    pref.enableBrowserPush = true;
    pref.reminderTimings = [60];
    pref.quietHoursEnabled = true;
    await pref.save();

    const updated = await NotificationPreference.findById(pref._id);
    expect(updated?.enableBrowserPush).toBe(true);
    expect(updated?.reminderTimings).toEqual([60]);
    expect(updated?.quietHoursEnabled).toBe(true);
  });

  it("updates updatedAt timestamp on save", async () => {
    const pref = await NotificationPreference.create({ userId });
    const originalUpdatedAt = pref.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    pref.enableBrowserPush = true;
    await pref.save();

    expect(pref.updatedAt.getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime(),
    );
  });

  it("allows empty reminderTimings array", async () => {
    const pref = await NotificationPreference.create({
      userId,
      reminderTimings: [],
    });

    expect(pref.reminderTimings).toEqual([]);
  });

  it("allows removing push subscription", async () => {
    const pref = await NotificationPreference.create({
      userId,
      pushSubscription: {
        endpoint: "https://example.com",
        keys: { p256dh: "key1", auth: "key2" },
      },
    });

    pref.pushSubscription = undefined;
    await pref.save();

    const updated = await NotificationPreference.findById(pref._id);
    expect(updated?.pushSubscription).toBeUndefined();
  });
});
