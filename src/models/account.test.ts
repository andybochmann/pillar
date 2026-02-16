import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers";
import { Account } from "@/models/account";

describe("Account Model", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  const userId = new mongoose.Types.ObjectId();

  it("creates an account with valid fields", async () => {
    const account = await Account.create({
      userId,
      provider: "google",
      providerAccountId: "google-123",
    });

    expect(account.userId.toString()).toBe(userId.toString());
    expect(account.provider).toBe("google");
    expect(account.providerAccountId).toBe("google-123");
    expect(account.createdAt).toBeInstanceOf(Date);
    expect(account.updatedAt).toBeInstanceOf(Date);
  });

  it("requires userId", async () => {
    await expect(
      Account.create({ provider: "google", providerAccountId: "123" }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("requires provider", async () => {
    await expect(
      Account.create({ userId, providerAccountId: "123" }),
    ).rejects.toThrow(/provider.*required/i);
  });

  it("requires providerAccountId", async () => {
    await expect(
      Account.create({ userId, provider: "google" }),
    ).rejects.toThrow(/providerAccountId.*required/i);
  });

  it("enforces unique provider + providerAccountId", async () => {
    await Account.create({
      userId,
      provider: "google",
      providerAccountId: "same-id",
    });

    await expect(
      Account.create({
        userId: new mongoose.Types.ObjectId(),
        provider: "google",
        providerAccountId: "same-id",
      }),
    ).rejects.toThrow();
  });

  it("enforces unique userId + provider", async () => {
    await Account.create({
      userId,
      provider: "google",
      providerAccountId: "id-1",
    });

    await expect(
      Account.create({
        userId,
        provider: "google",
        providerAccountId: "id-2",
      }),
    ).rejects.toThrow();
  });

  it("allows same user with different providers", async () => {
    await Account.create({
      userId,
      provider: "google",
      providerAccountId: "google-123",
    });

    const githubAccount = await Account.create({
      userId,
      provider: "github",
      providerAccountId: "github-456",
    });

    expect(githubAccount.provider).toBe("github");
  });

  it("allows same provider with different users", async () => {
    const userId2 = new mongoose.Types.ObjectId();

    await Account.create({
      userId,
      provider: "google",
      providerAccountId: "google-user1",
    });

    const account2 = await Account.create({
      userId: userId2,
      provider: "google",
      providerAccountId: "google-user2",
    });

    expect(account2.userId.toString()).toBe(userId2.toString());
  });
});
