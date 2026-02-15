import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
} from "@/test/helpers";
import { AccessToken } from "@/models/access-token";
import { hashToken } from "@/lib/mcp-auth";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "./route";

describe("/api/settings/tokens", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  async function seedUser() {
    const user = await createTestUser();
    session.user.id = user._id.toString();
    return user;
  }

  describe("GET", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns empty array for new user", async () => {
      await seedUser();
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns user's tokens sorted by createdAt desc", async () => {
      const user = await seedUser();
      await AccessToken.create({
        userId: user._id,
        name: "Token A",
        tokenHash: "hash_a",
        tokenPrefix: "plt_aaaa",
      });
      await AccessToken.create({
        userId: user._id,
        name: "Token B",
        tokenHash: "hash_b",
        tokenPrefix: "plt_bbbb",
      });

      const res = await GET();
      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body[0].name).toBe("Token B");
      expect(body[1].name).toBe("Token A");
      expect(body[0]).not.toHaveProperty("tokenHash");
      expect(body[0]).toHaveProperty("tokenPrefix");
      expect(body[0]).toHaveProperty("createdAt");
    });

    it("does not return other users tokens", async () => {
      await seedUser();
      const other = await createTestUser({ email: "other@example.com" });
      await AccessToken.create({
        userId: other._id,
        name: "Other Token",
        tokenHash: "hash_other",
        tokenPrefix: "plt_oooo",
      });

      const res = await GET();
      const body = await res.json();
      expect(body).toEqual([]);
    });
  });

  describe("POST", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const req = new NextRequest("http://localhost/api/settings/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("creates token and returns raw token string", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/settings/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Claude Desktop" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Claude Desktop");
      expect(body.token).toMatch(/^plt_[0-9a-f]{64}$/);
      expect(body.tokenPrefix).toMatch(/^plt_[0-9a-f]{4}$/);
      expect(body._id).toBeDefined();

      // Verify it was stored in DB
      const stored = await AccessToken.findById(body._id);
      expect(stored).not.toBeNull();
      expect(stored!.tokenHash).toBe(hashToken(body.token));
    });

    it("returns 400 for empty name", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/settings/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing name", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/settings/tokens", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when max 10 tokens reached", async () => {
      const user = await seedUser();
      for (let i = 0; i < 10; i++) {
        await AccessToken.create({
          userId: user._id,
          name: `Token ${i}`,
          tokenHash: `hash_limit_${i}`,
          tokenPrefix: `plt_${i}000`,
        });
      }

      const req = new NextRequest("http://localhost/api/settings/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "One More" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("10");
    });
  });
});
