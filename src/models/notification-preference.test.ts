import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
} from "vitest";
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
    expect(pref.enableInAppNotifications).toBe(true);
    expect(pref.quietHoursEnabled).toBe(false);
    expect(pref.quietHoursStart).toBe("22:00");
    expect(pref.quietHoursEnd).toBe("08:00");
    expect(pref.enableOverdueSummary).toBe(true);
    expect(pref.enableDailySummary).toBe(true);
    expect(pref.dailySummaryTime).toBe("09:00");
    expect(pref.dueDateReminders).toHaveLength(2);
    expect(pref.dueDateReminders[0].daysBefore).toBe(1);
    expect(pref.dueDateReminders[0].time).toBe("09:00");
    expect(pref.dueDateReminders[1].daysBefore).toBe(0);
    expect(pref.dueDateReminders[1].time).toBe("08:00");
    expect(pref.timezone).toBe("UTC");
    expect(pref.createdAt).toBeInstanceOf(Date);
    expect(pref.updatedAt).toBeInstanceOf(Date);
  });

  it("creates notification preferences with custom values", async () => {
    const pref = await NotificationPreference.create({
      userId,
      enableInAppNotifications: false,
      quietHoursEnabled: true,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      enableOverdueSummary: false,
      enableDailySummary: false,
      dailySummaryTime: "08:30",
    });

    expect(pref.enableInAppNotifications).toBe(false);
    expect(pref.quietHoursEnabled).toBe(true);
    expect(pref.quietHoursStart).toBe("23:00");
    expect(pref.quietHoursEnd).toBe("07:00");
    expect(pref.enableOverdueSummary).toBe(false);
    expect(pref.enableDailySummary).toBe(false);
    expect(pref.dailySummaryTime).toBe("08:30");
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

  it("validates dailySummaryTime format", async () => {
    await expect(
      NotificationPreference.create({
        userId,
        dailySummaryTime: "25:00",
      }),
    ).rejects.toThrow(/dailySummaryTime must be in HH:mm format/i);

    await expect(
      NotificationPreference.create({
        userId,
        dailySummaryTime: "9am",
      }),
    ).rejects.toThrow(/dailySummaryTime must be in HH:mm format/i);
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

  it("allows updating notification preferences", async () => {
    const pref = await NotificationPreference.create({ userId });

    pref.enableInAppNotifications = false;
    pref.quietHoursEnabled = true;
    await pref.save();

    const updated = await NotificationPreference.findById(pref._id);
    expect(updated?.enableInAppNotifications).toBe(false);
    expect(updated?.quietHoursEnabled).toBe(true);
  });

  it("updates updatedAt timestamp on save", async () => {
    const pref = await NotificationPreference.create({ userId });
    const originalUpdatedAt = pref.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    pref.enableInAppNotifications = false;
    await pref.save();

    expect(pref.updatedAt.getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime(),
    );
  });

  it("stores custom dueDateReminders", async () => {
    const pref = await NotificationPreference.create({
      userId,
      dueDateReminders: [
        { daysBefore: 7, time: "10:00" },
        { daysBefore: 0, time: "20:00" },
      ],
    });

    expect(pref.dueDateReminders).toHaveLength(2);
    expect(pref.dueDateReminders[0].daysBefore).toBe(7);
    expect(pref.dueDateReminders[0].time).toBe("10:00");
    expect(pref.dueDateReminders[1].daysBefore).toBe(0);
    expect(pref.dueDateReminders[1].time).toBe("20:00");
  });

  it("validates dueDateReminder time format", async () => {
    await expect(
      NotificationPreference.create({
        userId,
        dueDateReminders: [{ daysBefore: 1, time: "25:00" }],
      }),
    ).rejects.toThrow(/time must be in HH:mm format/i);
  });
});
