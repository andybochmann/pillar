import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers";
import { User } from "@/models/user";

describe("User Model", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it("creates a user with valid fields", async () => {
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com",
      passwordHash: "hashedpassword123",
    });

    expect(user.name).toBe("John Doe");
    expect(user.email).toBe("john@example.com");
    expect(user.passwordHash).toBe("hashedpassword123");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("requires name field", async () => {
    await expect(
      User.create({ email: "test@example.com", passwordHash: "hash" }),
    ).rejects.toThrow(/name.*required/i);
  });

  it("requires email field", async () => {
    await expect(
      User.create({ name: "Test", passwordHash: "hash" }),
    ).rejects.toThrow(/email.*required/i);
  });

  it("allows user without passwordHash (OAuth user)", async () => {
    const user = await User.create({
      name: "OAuth User",
      email: "oauth@example.com",
    });

    expect(user.name).toBe("OAuth User");
    expect(user.email).toBe("oauth@example.com");
    expect(user.passwordHash).toBeUndefined();
  });

  it("enforces unique email", async () => {
    await User.create({
      name: "User 1",
      email: "dupe@example.com",
      passwordHash: "hash1",
    });

    await expect(
      User.create({
        name: "User 2",
        email: "dupe@example.com",
        passwordHash: "hash2",
      }),
    ).rejects.toThrow();
  });

  it("lowercases email", async () => {
    const user = await User.create({
      name: "Test",
      email: "UPPER@EXAMPLE.COM",
      passwordHash: "hash",
    });

    expect(user.email).toBe("upper@example.com");
  });

  it("trims name and email", async () => {
    const user = await User.create({
      name: "  John Doe  ",
      email: "  john@example.com  ",
      passwordHash: "hash",
    });

    expect(user.name).toBe("John Doe");
    expect(user.email).toBe("john@example.com");
  });
});
