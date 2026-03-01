import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, createTestUser } from "@/test/helpers";
import { FilterPreset } from "@/models/filter-preset";

describe("FilterPreset Model", () => {
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
    await FilterPreset.deleteMany({});
  });

  it("creates a filter preset with valid fields", async () => {
    const preset = await FilterPreset.create({
      name: "My Urgent Tasks",
      userId,
      context: "overview",
      filters: { priority: "urgent", completed: "false" },
      order: 0,
    });

    expect(preset.name).toBe("My Urgent Tasks");
    expect(preset.userId.toString()).toBe(userId.toString());
    expect(preset.context).toBe("overview");
    expect(preset.filters).toEqual({ priority: "urgent", completed: "false" });
    expect(preset.order).toBe(0);
    expect(preset.createdAt).toBeDefined();
    expect(preset.updatedAt).toBeDefined();
  });

  it("requires name field", async () => {
    await expect(
      FilterPreset.create({ userId, context: "overview", filters: {} }),
    ).rejects.toThrow(/name.*required/i);
  });

  it("requires userId field", async () => {
    await expect(
      FilterPreset.create({ name: "Test", context: "overview", filters: {} }),
    ).rejects.toThrow(/userId.*required/i);
  });

  it("requires context field", async () => {
    await expect(
      FilterPreset.create({ name: "Test", userId, filters: {} }),
    ).rejects.toThrow(/context.*required/i);
  });

  it("rejects invalid context value", async () => {
    await expect(
      FilterPreset.create({
        name: "Test",
        userId,
        context: "invalid",
        filters: {},
      }),
    ).rejects.toThrow();
  });

  it("trims name", async () => {
    const preset = await FilterPreset.create({
      name: "  My Preset  ",
      userId,
      context: "kanban",
      filters: {},
    });
    expect(preset.name).toBe("My Preset");
  });

  it("enforces max name length of 50", async () => {
    await expect(
      FilterPreset.create({
        name: "a".repeat(51),
        userId,
        context: "overview",
        filters: {},
      }),
    ).rejects.toThrow();
  });

  it("defaults order to 0", async () => {
    const preset = await FilterPreset.create({
      name: "Test",
      userId,
      context: "overview",
      filters: {},
    });
    expect(preset.order).toBe(0);
  });

  it("defaults filters to empty object", async () => {
    const preset = await FilterPreset.create({
      name: "Test",
      userId,
      context: "overview",
    });
    expect(preset.filters).toEqual({});
  });

  it("stores array values in filters", async () => {
    const preset = await FilterPreset.create({
      name: "Test",
      userId,
      context: "kanban",
      filters: { priorities: ["urgent", "high"], labels: ["label1", "label2"] },
    });
    expect(preset.filters.priorities).toEqual(["urgent", "high"]);
    expect(preset.filters.labels).toEqual(["label1", "label2"]);
  });

  it("allows both overview and kanban contexts", async () => {
    const overview = await FilterPreset.create({
      name: "Overview Preset",
      userId,
      context: "overview",
      filters: {},
    });
    const kanban = await FilterPreset.create({
      name: "Kanban Preset",
      userId,
      context: "kanban",
      filters: {},
    });
    expect(overview.context).toBe("overview");
    expect(kanban.context).toBe("kanban");
  });
});
