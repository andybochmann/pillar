import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, createTestUser } from "@/test/helpers";
import { Category } from "@/models/category";

describe("Category Model", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    const user = await createTestUser();
    userId = user._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Category.deleteMany({});
  });

  it("creates a category with valid fields", async () => {
    const category = await Category.create({
      name: "Work",
      color: "#3b82f6",
      userId,
      order: 0,
    });

    expect(category.name).toBe("Work");
    expect(category.color).toBe("#3b82f6");
    expect(category.userId.toString()).toBe(userId.toString());
    expect(category.order).toBe(0);
  });

  it("requires name field", async () => {
    await expect(
      Category.create({ color: "#fff", userId, order: 0 }),
    ).rejects.toThrow(/name.*required/i);
  });

  it("requires userId field", async () => {
    await expect(
      Category.create({ name: "Test", color: "#fff", order: 0 }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("uses default color when not provided", async () => {
    const category = await Category.create({
      name: "Personal",
      userId,
      order: 1,
    });

    expect(category.color).toBe("#6366f1");
  });

  it("rejects name exceeding maxlength of 50", async () => {
    await expect(
      Category.create({
        name: "x".repeat(51),
        userId,
        order: 0,
      }),
    ).rejects.toThrow();
  });

  it("trims name", async () => {
    const category = await Category.create({
      name: "  Work  ",
      userId,
      order: 0,
    });

    expect(category.name).toBe("Work");
  });
});
