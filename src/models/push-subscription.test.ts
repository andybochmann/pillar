import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, createTestUser } from "@/test/helpers";
import { PushSubscription } from "@/models/push-subscription";

describe("PushSubscription Model", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    await PushSubscription.init();
    const user = await createTestUser();
    userId = user._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await PushSubscription.deleteMany({});
  });

  it("creates a web subscription with valid fields", async () => {
    const sub = await PushSubscription.create({
      userId,
      platform: "web",
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: {
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ=",
        auth: "tBHItJI5svbpC7htQ-VNRQ==",
      },
      userAgent: "Mozilla/5.0",
    });

    expect(sub.platform).toBe("web");
    expect(sub.endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc123");
    expect(sub.keys!.p256dh).toBe("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ=");
    expect(sub.keys!.auth).toBe("tBHItJI5svbpC7htQ-VNRQ==");
    expect(sub.userAgent).toBe("Mozilla/5.0");
    expect(sub.userId.toString()).toBe(userId.toString());
    expect(sub.createdAt).toBeDefined();
  });

  it("defaults platform to web", async () => {
    const sub = await PushSubscription.create({
      userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/default-platform",
      keys: { p256dh: "key1", auth: "key2" },
    });
    expect(sub.platform).toBe("web");
  });

  it("creates a native android subscription", async () => {
    const sub = await PushSubscription.create({
      userId,
      platform: "android",
      deviceToken: "fcm-token-abc123",
    });

    expect(sub.platform).toBe("android");
    expect(sub.deviceToken).toBe("fcm-token-abc123");
    expect(sub.endpoint).toBeUndefined();
    // Mongoose creates the nested subdoc even without values
    expect(sub.keys?.p256dh).toBeUndefined();
    expect(sub.keys?.auth).toBeUndefined();
  });

  it("creates a native ios subscription", async () => {
    const sub = await PushSubscription.create({
      userId,
      platform: "ios",
      deviceToken: "apns-token-xyz",
    });

    expect(sub.platform).toBe("ios");
    expect(sub.deviceToken).toBe("apns-token-xyz");
  });

  it("requires userId", async () => {
    await expect(
      PushSubscription.create({
        endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
        keys: { p256dh: "key1", auth: "key2" },
      }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("enforces unique endpoint (sparse)", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/unique-test";
    await PushSubscription.create({
      userId,
      endpoint,
      keys: { p256dh: "key1", auth: "key2" },
    });
    await expect(
      PushSubscription.create({
        userId,
        endpoint,
        keys: { p256dh: "key3", auth: "key4" },
      }),
    ).rejects.toThrow();
  });

  it("enforces unique deviceToken (sparse)", async () => {
    await PushSubscription.create({
      userId,
      platform: "android",
      deviceToken: "duplicate-token",
    });
    await expect(
      PushSubscription.create({
        userId,
        platform: "android",
        deviceToken: "duplicate-token",
      }),
    ).rejects.toThrow();
  });

  it("allows multiple subscriptions for the same user", async () => {
    await PushSubscription.create({
      userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/device1",
      keys: { p256dh: "key1", auth: "auth1" },
    });
    await PushSubscription.create({
      userId,
      platform: "android",
      deviceToken: "android-token-1",
    });

    const subs = await PushSubscription.find({ userId });
    expect(subs).toHaveLength(2);
  });

  it("allows null endpoint and null deviceToken on different docs", async () => {
    // Two native subs without endpoint should not conflict on sparse unique
    await PushSubscription.create({
      userId,
      platform: "android",
      deviceToken: "token-a",
    });
    await PushSubscription.create({
      userId,
      platform: "android",
      deviceToken: "token-b",
    });

    const subs = await PushSubscription.find({ userId });
    expect(subs).toHaveLength(2);
  });

  it("userAgent is optional", async () => {
    const sub = await PushSubscription.create({
      userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/no-ua",
      keys: { p256dh: "key1", auth: "auth1" },
    });
    expect(sub.userAgent).toBeUndefined();
  });

  it("rejects invalid platform value", async () => {
    await expect(
      PushSubscription.create({
        userId,
        platform: "windows",
        deviceToken: "some-token",
      }),
    ).rejects.toThrow();
  });
});
