import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
} from "@/test/helpers";
import { FilterPreset } from "@/models/filter-preset";
import { PATCH, DELETE } from "./route";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("Filter Presets [id] API", () => {
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

  async function setupUser() {
    const user = await createTestUser({ email: "preset-id@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();
  }

  function patchRequest(id: string, body: Record<string, unknown>) {
    return new NextRequest(
      `http://localhost:3000/api/filter-presets/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  function deleteRequest(id: string) {
    return new NextRequest(
      `http://localhost:3000/api/filter-presets/${id}`,
      { method: "DELETE" },
    );
  }

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  describe("PATCH /api/filter-presets/[id]", () => {
    it("updates preset name", async () => {
      await setupUser();
      const preset = await FilterPreset.create({
        name: "Old Name",
        userId,
        context: "overview",
        filters: { priority: "urgent" },
      });

      const res = await PATCH(
        patchRequest(preset._id.toString(), { name: "New Name" }),
        makeParams(preset._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("New Name");
    });

    it("updates preset filters", async () => {
      await setupUser();
      const preset = await FilterPreset.create({
        name: "Test",
        userId,
        context: "overview",
        filters: { priority: "urgent" },
      });

      const res = await PATCH(
        patchRequest(preset._id.toString(), {
          filters: { priority: "high", completed: "true" },
        }),
        makeParams(preset._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.filters).toEqual({ priority: "high", completed: "true" });
    });

    it("returns 404 for non-existent preset", async () => {
      await setupUser();
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await PATCH(
        patchRequest(fakeId, { name: "Test" }),
        makeParams(fakeId),
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's preset", async () => {
      await setupUser();
      const otherUser = await createTestUser({ email: "other2@example.com" });
      const preset = await FilterPreset.create({
        name: "Other's Preset",
        userId: otherUser._id as mongoose.Types.ObjectId,
        context: "overview",
        filters: {},
      });

      const res = await PATCH(
        patchRequest(preset._id.toString(), { name: "Stolen" }),
        makeParams(preset._id.toString()),
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for empty name", async () => {
      await setupUser();
      const preset = await FilterPreset.create({
        name: "Test",
        userId,
        context: "overview",
        filters: {},
      });

      const res = await PATCH(
        patchRequest(preset._id.toString(), { name: "" }),
        makeParams(preset._id.toString()),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for name exceeding 50 chars", async () => {
      await setupUser();
      const preset = await FilterPreset.create({
        name: "Test",
        userId,
        context: "overview",
        filters: {},
      });

      const res = await PATCH(
        patchRequest(preset._id.toString(), { name: "a".repeat(51) }),
        makeParams(preset._id.toString()),
      );
      expect(res.status).toBe(400);
    });

    it("returns 401 for unauthenticated request", async () => {
      const { auth } = await import("@/lib/auth");
      vi.mocked(auth).mockResolvedValueOnce(null);
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await PATCH(
        patchRequest(fakeId, { name: "Test" }),
        makeParams(fakeId),
      );
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/filter-presets/[id]", () => {
    it("deletes a preset", async () => {
      await setupUser();
      const preset = await FilterPreset.create({
        name: "To Delete",
        userId,
        context: "overview",
        filters: {},
      });

      const res = await DELETE(
        deleteRequest(preset._id.toString()),
        makeParams(preset._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const found = await FilterPreset.findById(preset._id);
      expect(found).toBeNull();
    });

    it("returns 404 for non-existent preset", async () => {
      await setupUser();
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await DELETE(deleteRequest(fakeId), makeParams(fakeId));
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's preset", async () => {
      await setupUser();
      const otherUser = await createTestUser({ email: "other3@example.com" });
      const preset = await FilterPreset.create({
        name: "Other's Preset",
        userId: otherUser._id as mongoose.Types.ObjectId,
        context: "overview",
        filters: {},
      });

      const res = await DELETE(
        deleteRequest(preset._id.toString()),
        makeParams(preset._id.toString()),
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 for unauthenticated request", async () => {
      const { auth } = await import("@/lib/auth");
      vi.mocked(auth).mockResolvedValueOnce(null);
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await DELETE(deleteRequest(fakeId), makeParams(fakeId));
      expect(res.status).toBe(401);
    });
  });
});
