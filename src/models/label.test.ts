import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, createTestUser } from "@/test/helpers";
import { Label } from "@/models/label";

describe("Label Model", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    await Label.init(); // ensure unique index is built
    const user = await createTestUser();
    userId = user._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Label.deleteMany({});
  });

  it("creates a label with valid fields", async () => {
    const label = await Label.create({
      name: "Bug",
      color: "#ef4444",
      userId,
    });

    expect(label.name).toBe("Bug");
    expect(label.color).toBe("#ef4444");
    expect(label.userId.toString()).toBe(userId.toString());
    expect(label.createdAt).toBeDefined();
  });

  it("requires name field", async () => {
    await expect(Label.create({ color: "#ef4444", userId })).rejects.toThrow(
      /name.*required/i,
    );
  });

  it("requires color field", async () => {
    await expect(Label.create({ name: "Bug", userId })).rejects.toThrow(
      /color.*required/i,
    );
  });

  it("requires userId field", async () => {
    await expect(
      Label.create({ name: "Bug", color: "#ef4444" }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("rejects invalid hex color", async () => {
    await expect(
      Label.create({ name: "Bug", color: "not-a-color", userId }),
    ).rejects.toThrow();
  });

  it("trims name", async () => {
    const label = await Label.create({
      name: "  Bug  ",
      color: "#ef4444",
      userId,
    });

    expect(label.name).toBe("Bug");
  });

  it("enforces max name length of 50", async () => {
    await expect(
      Label.create({ name: "a".repeat(51), color: "#ef4444", userId }),
    ).rejects.toThrow();
  });

  it("enforces unique name per user", async () => {
    await Label.create({ name: "Bug", color: "#ef4444", userId });
    await expect(
      Label.create({ name: "Bug", color: "#3b82f6", userId }),
    ).rejects.toThrow();
  });

  it("allows same name for different users", async () => {
    const user2 = await createTestUser({ email: "user2@example.com" });
    await Label.create({ name: "Bug", color: "#ef4444", userId });
    const label2 = await Label.create({
      name: "Bug",
      color: "#3b82f6",
      userId: user2._id,
    });

    expect(label2.name).toBe("Bug");
  });
});
