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
import { User } from "@/models/user";

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

import { GET, POST, DELETE } from "./route";

const ORIGIN = "http://localhost:3000";

function req(method: string): NextRequest {
  return new NextRequest(`${ORIGIN}/api/settings/calendar-feed`, {
    method,
    headers: { host: "localhost:3000" },
  });
}

describe("/api/settings/calendar-feed", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
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
      const res = await GET(req("GET"));
      expect(res.status).toBe(401);
    });

    it("returns disabled state for a user with no token", async () => {
      await seedUser();
      const res = await GET(req("GET"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ enabled: false, url: null });
    });

    it("returns the feed URL when a token exists", async () => {
      process.env.AUTH_URL = "https://pillar.example.com";
      const user = await seedUser();
      user.calendarFeedToken = "a".repeat(64);
      await user.save();

      const res = await GET(req("GET"));
      const body = await res.json();
      expect(body.enabled).toBe(true);
      expect(body.url).toBe(
        `https://pillar.example.com/api/calendar/${"a".repeat(64)}/feed.ics`,
      );
    });
  });

  describe("POST", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const res = await POST(req("POST"));
      expect(res.status).toBe(401);
    });

    it("generates a token and returns the URL", async () => {
      process.env.AUTH_URL = "https://pillar.example.com";
      const user = await seedUser();
      const res = await POST(req("POST"));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.enabled).toBe(true);
      expect(body.url).toMatch(
        /^https:\/\/pillar\.example\.com\/api\/calendar\/[a-f0-9]{64}\/feed\.ics$/,
      );

      const stored = await User.findById(user._id).select("calendarFeedToken");
      expect(stored!.calendarFeedToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it("regenerating replaces the previous token (revokes old URL)", async () => {
      await seedUser();
      const first = await (await POST(req("POST"))).json();
      const second = await (await POST(req("POST"))).json();
      expect(first.url).not.toBe(second.url);
    });

    it("derives the base URL from request headers when no env is set", async () => {
      await seedUser();
      const request = new NextRequest(
        "http://localhost/api/settings/calendar-feed",
        {
          method: "POST",
          headers: {
            "x-forwarded-host": "tasks.myhost.dev",
            "x-forwarded-proto": "https",
          },
        },
      );
      const body = await (await POST(request)).json();
      expect(body.url).toMatch(
        /^https:\/\/tasks\.myhost\.dev\/api\/calendar\/[a-f0-9]{64}\/feed\.ics$/,
      );
    });
  });

  describe("DELETE", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const res = await DELETE();
      expect(res.status).toBe(401);
    });

    it("unsets the token", async () => {
      const user = await seedUser();
      user.calendarFeedToken = "b".repeat(64);
      await user.save();

      const res = await DELETE();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const stored = await User.findById(user._id).select("calendarFeedToken");
      expect(stored!.calendarFeedToken).toBeUndefined();
    });
  });
});
