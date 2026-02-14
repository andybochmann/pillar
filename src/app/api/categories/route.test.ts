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
  createTestCategory,
} from "@/test/helpers";
import { GET, POST } from "./route";

const session = vi.hoisted(() => ({
  user: { id: "507f1f77bcf86cd799439011", name: "Test User", email: "test@example.com" },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("Categories API", () => {
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
    const user = await createTestUser({ email: "cat@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();
  }

  describe("GET /api/categories", () => {
    it("returns user categories sorted by order", async () => {
      await setupUser();
      await createTestCategory({ userId, name: "B", order: 1 });
      await createTestCategory({ userId, name: "A", order: 0 });

      const res = await GET(
        new NextRequest("http://localhost:3000/api/categories"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("A");
      expect(data[1].name).toBe("B");
    });

    it("returns 401 for unauthenticated request", async () => {
      const { auth } = await import("@/lib/auth");
      vi.mocked(auth).mockResolvedValueOnce(null);

      const res = await GET(
        new NextRequest("http://localhost:3000/api/categories"),
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/categories", () => {
    function createRequest(body: Record<string, unknown>) {
      return new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("creates a category with auto-order", async () => {
      await setupUser();
      const res = await POST(
        createRequest({ name: "Work", color: "#6366f1" }),
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Work");
      expect(data.color).toBe("#6366f1");
      expect(data.order).toBe(0);
    });

    it("returns 400 for missing name", async () => {
      await setupUser();
      const res = await POST(createRequest({ color: "#6366f1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid color", async () => {
      await setupUser();
      const res = await POST(
        createRequest({ name: "Test", color: "not-a-color" }),
      );
      expect(res.status).toBe(400);
    });
  });
});
