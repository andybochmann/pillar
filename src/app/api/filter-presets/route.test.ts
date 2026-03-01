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
import { GET, POST } from "./route";

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

describe("Filter Presets API", () => {
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
    const user = await createTestUser({ email: "presets@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();
  }

  describe("GET /api/filter-presets", () => {
    it("returns all presets for the user", async () => {
      await setupUser();
      await FilterPreset.create({
        name: "Preset 1",
        userId,
        context: "overview",
        filters: { priority: "urgent" },
        order: 0,
      });
      await FilterPreset.create({
        name: "Preset 2",
        userId,
        context: "kanban",
        filters: { priorities: ["high"] },
        order: 1,
      });

      const res = await GET(
        new NextRequest("http://localhost:3000/api/filter-presets"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    it("filters by context query param", async () => {
      await setupUser();
      await FilterPreset.create({
        name: "Overview Preset",
        userId,
        context: "overview",
        filters: {},
        order: 0,
      });
      await FilterPreset.create({
        name: "Kanban Preset",
        userId,
        context: "kanban",
        filters: {},
        order: 0,
      });

      const res = await GET(
        new NextRequest(
          "http://localhost:3000/api/filter-presets?context=overview",
        ),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Overview Preset");
    });

    it("returns presets sorted by order", async () => {
      await setupUser();
      await FilterPreset.create({
        name: "Second",
        userId,
        context: "overview",
        filters: {},
        order: 1,
      });
      await FilterPreset.create({
        name: "First",
        userId,
        context: "overview",
        filters: {},
        order: 0,
      });

      const res = await GET(
        new NextRequest("http://localhost:3000/api/filter-presets"),
      );
      const data = await res.json();
      expect(data[0].name).toBe("First");
      expect(data[1].name).toBe("Second");
    });

    it("returns 401 for unauthenticated request", async () => {
      const { auth } = await import("@/lib/auth");
      vi.mocked(auth).mockResolvedValueOnce(null);

      const res = await GET(
        new NextRequest("http://localhost:3000/api/filter-presets"),
      );
      expect(res.status).toBe(401);
    });

    it("only returns presets for the authenticated user", async () => {
      await setupUser();
      await FilterPreset.create({
        name: "My Preset",
        userId,
        context: "overview",
        filters: {},
      });

      const otherUser = await createTestUser({ email: "other@example.com" });
      await FilterPreset.create({
        name: "Other Preset",
        userId: otherUser._id as mongoose.Types.ObjectId,
        context: "overview",
        filters: {},
      });

      const res = await GET(
        new NextRequest("http://localhost:3000/api/filter-presets"),
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("My Preset");
    });
  });

  describe("POST /api/filter-presets", () => {
    function createRequest(body: Record<string, unknown>) {
      return new NextRequest("http://localhost:3000/api/filter-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("creates a filter preset", async () => {
      await setupUser();
      const res = await POST(
        createRequest({
          name: "Urgent Tasks",
          context: "overview",
          filters: { priority: "urgent", completed: "false" },
        }),
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Urgent Tasks");
      expect(data.context).toBe("overview");
      expect(data.filters).toEqual({ priority: "urgent", completed: "false" });
      expect(data.userId).toBe(userId.toString());
    });

    it("auto-assigns order based on existing count", async () => {
      await setupUser();
      await FilterPreset.create({
        name: "Existing",
        userId,
        context: "overview",
        filters: {},
        order: 0,
      });

      const res = await POST(
        createRequest({
          name: "New Preset",
          context: "overview",
          filters: {},
        }),
      );
      const data = await res.json();
      expect(data.order).toBe(1);
    });

    it("returns 400 for missing name", async () => {
      await setupUser();
      const res = await POST(
        createRequest({ context: "overview", filters: {} }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing context", async () => {
      await setupUser();
      const res = await POST(
        createRequest({ name: "Test", filters: {} }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid context", async () => {
      await setupUser();
      const res = await POST(
        createRequest({ name: "Test", context: "invalid", filters: {} }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for name exceeding 50 chars", async () => {
      await setupUser();
      const res = await POST(
        createRequest({
          name: "a".repeat(51),
          context: "overview",
          filters: {},
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 401 for unauthenticated request", async () => {
      const { auth } = await import("@/lib/auth");
      vi.mocked(auth).mockResolvedValueOnce(null);

      const res = await POST(
        createRequest({
          name: "Test",
          context: "overview",
          filters: {},
        }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 when preset limit of 50 per context is reached", async () => {
      await setupUser();
      await FilterPreset.insertMany(
        Array.from({ length: 50 }, (_, i) => ({
          name: `Preset ${i}`,
          userId,
          context: "overview",
          filters: {},
          order: i,
        })),
      );

      const res = await POST(
        createRequest({
          name: "One Too Many",
          context: "overview",
          filters: {},
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/maximum/i);
    });

    it("allows creating preset in different context when one is at limit", async () => {
      await setupUser();
      await FilterPreset.insertMany(
        Array.from({ length: 50 }, (_, i) => ({
          name: `Preset ${i}`,
          userId,
          context: "overview",
          filters: {},
          order: i,
        })),
      );

      const res = await POST(
        createRequest({
          name: "Kanban Preset",
          context: "kanban",
          filters: {},
        }),
      );
      expect(res.status).toBe(201);
    });
  });
});
