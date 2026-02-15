import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, createTestUser } from "@/test/helpers";
import { AccessToken } from "@/models/access-token";

describe("AccessToken Model", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    await AccessToken.init();
    const user = await createTestUser();
    userId = user._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await AccessToken.deleteMany({});
  });

  it("creates a token with valid fields", async () => {
    const token = await AccessToken.create({
      userId,
      name: "Claude Desktop",
      tokenHash: "abc123def456",
      tokenPrefix: "plt_a1b2",
    });

    expect(token.name).toBe("Claude Desktop");
    expect(token.tokenHash).toBe("abc123def456");
    expect(token.tokenPrefix).toBe("plt_a1b2");
    expect(token.userId.toString()).toBe(userId.toString());
    expect(token.lastUsedAt).toBeNull();
    expect(token.expiresAt).toBeNull();
    expect(token.createdAt).toBeDefined();
  });

  it("requires userId field", async () => {
    await expect(
      AccessToken.create({
        name: "Test",
        tokenHash: "hash1",
        tokenPrefix: "plt_1234",
      }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("requires name field", async () => {
    await expect(
      AccessToken.create({
        userId,
        tokenHash: "hash2",
        tokenPrefix: "plt_1234",
      }),
    ).rejects.toThrow(/name.*required/i);
  });

  it("requires tokenHash field", async () => {
    await expect(
      AccessToken.create({
        userId,
        name: "Test",
        tokenPrefix: "plt_1234",
      }),
    ).rejects.toThrow(/tokenHash.*required/i);
  });

  it("requires tokenPrefix field", async () => {
    await expect(
      AccessToken.create({
        userId,
        name: "Test",
        tokenHash: "hash3",
      }),
    ).rejects.toThrow(/tokenPrefix.*required/i);
  });

  it("enforces unique tokenHash", async () => {
    await AccessToken.create({
      userId,
      name: "Token 1",
      tokenHash: "unique-hash",
      tokenPrefix: "plt_aaaa",
    });
    await expect(
      AccessToken.create({
        userId,
        name: "Token 2",
        tokenHash: "unique-hash",
        tokenPrefix: "plt_bbbb",
      }),
    ).rejects.toThrow();
  });

  it("trims name", async () => {
    const token = await AccessToken.create({
      userId,
      name: "  Claude Desktop  ",
      tokenHash: "hash4",
      tokenPrefix: "plt_1234",
    });
    expect(token.name).toBe("Claude Desktop");
  });

  it("enforces max name length of 100", async () => {
    await expect(
      AccessToken.create({
        userId,
        name: "a".repeat(101),
        tokenHash: "hash5",
        tokenPrefix: "plt_1234",
      }),
    ).rejects.toThrow();
  });

  it("sets default lastUsedAt to null", async () => {
    const token = await AccessToken.create({
      userId,
      name: "Test",
      tokenHash: "hash6",
      tokenPrefix: "plt_1234",
    });
    expect(token.lastUsedAt).toBeNull();
  });

  it("stores expiresAt when provided", async () => {
    const expires = new Date("2030-01-01");
    const token = await AccessToken.create({
      userId,
      name: "Expiring Token",
      tokenHash: "hash7",
      tokenPrefix: "plt_1234",
      expiresAt: expires,
    });
    expect(token.expiresAt!.getTime()).toBe(expires.getTime());
  });
});
