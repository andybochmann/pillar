import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Account } from "@/models/account";
import { User } from "@/models/user";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
} from "@/test/helpers/db";
import {
  createTestUser,
  createTestAccount,
} from "@/test/helpers/factories";
import { migrateAccounts } from "./migrate-accounts";

describe("migrate-accounts", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it("creates Account records for users with passwords", async () => {
    const user1 = await createTestUser({ email: "user1@test.com" });
    const user2 = await createTestUser({ email: "user2@test.com" });

    const result = await migrateAccounts();

    expect(result.processed).toBe(2);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);

    const account1 = await Account.findOne({
      userId: user1._id,
      provider: "credentials",
    });
    expect(account1).not.toBeNull();
    expect(account1!.providerAccountId).toBe(user1._id.toString());

    const account2 = await Account.findOne({
      userId: user2._id,
      provider: "credentials",
    });
    expect(account2).not.toBeNull();
  });

  it("skips users that already have credentials Account", async () => {
    const user1 = await createTestUser({ email: "user1@test.com" });
    const user2 = await createTestUser({ email: "user2@test.com" });

    await createTestAccount({ userId: user1._id, provider: "credentials" });

    const result = await migrateAccounts();

    expect(result.processed).toBe(2);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("ignores OAuth-only users (no passwordHash)", async () => {
    await createTestUser({ email: "password@test.com" });
    await User.create({
      name: "OAuth User",
      email: "oauth@test.com",
    });

    const result = await migrateAccounts();

    expect(result.processed).toBe(1);
    expect(result.created).toBe(1);

    const oauthAccount = await Account.findOne({
      provider: "credentials",
    });
    expect(oauthAccount!.userId.toString()).not.toBe(
      (await User.findOne({ email: "oauth@test.com" }))!._id.toString(),
    );
  });

  it("is idempotent — running twice produces the same result", async () => {
    await createTestUser({ email: "user1@test.com" });
    await createTestUser({ email: "user2@test.com" });

    const result1 = await migrateAccounts();
    expect(result1.created).toBe(2);
    expect(result1.skipped).toBe(0);

    const result2 = await migrateAccounts();
    expect(result2.created).toBe(0);
    expect(result2.skipped).toBe(2);

    const totalAccounts = await Account.countDocuments({ provider: "credentials" });
    expect(totalAccounts).toBe(2);
  });
});
