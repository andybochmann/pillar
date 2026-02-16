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

  it("creates a subscription with valid fields", async () => {
    const sub = await PushSubscription.create({
      userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: {
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ=",
        auth: "tBHItJI5svbpC7htQ-VNRQ==",
      },
      userAgent: "Mozilla/5.0",
    });

    expect(sub.endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc123");
    expect(sub.keys.p256dh).toBe("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ=");
    expect(sub.keys.auth).toBe("tBHItJI5svbpC7htQ-VNRQ==");
    expect(sub.userAgent).toBe("Mozilla/5.0");
    expect(sub.userId.toString()).toBe(userId.toString());
    expect(sub.createdAt).toBeDefined();
  });

  it("requires userId", async () => {
    await expect(
      PushSubscription.create({
        endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
        keys: { p256dh: "key1", auth: "key2" },
      }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("requires endpoint", async () => {
    await expect(
      PushSubscription.create({
        userId,
        keys: { p256dh: "key1", auth: "key2" },
      }),
    ).rejects.toThrow(/endpoint.*required/i);
  });

  it("requires keys.p256dh", async () => {
    await expect(
      PushSubscription.create({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
        keys: { auth: "key2" },
      }),
    ).rejects.toThrow(/p256dh.*required/i);
  });

  it("requires keys.auth", async () => {
    await expect(
      PushSubscription.create({
        userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
        keys: { p256dh: "key1" },
      }),
    ).rejects.toThrow(/auth.*required/i);
  });

  it("enforces unique endpoint", async () => {
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

  it("allows multiple subscriptions for the same user", async () => {
    await PushSubscription.create({
      userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/device1",
      keys: { p256dh: "key1", auth: "auth1" },
    });
    await PushSubscription.create({
      userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/device2",
      keys: { p256dh: "key2", auth: "auth2" },
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
});
