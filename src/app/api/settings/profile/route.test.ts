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
import { GET, PATCH, DELETE } from "./route";

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

describe("/api/settings/profile", () => {
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

    it("returns user profile", async () => {
      await seedUser();
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Test User");
      expect(body.email).toContain("@");
      expect(body.id).toBe(session.user.id);
    });
  });

  describe("PATCH", () => {
    it("updates user name", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name" }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Name");
    });

    it("returns 400 for invalid data", async () => {
      await seedUser();
      const req = new NextRequest("http://localhost/api/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "" }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("deletes user account", async () => {
      await seedUser();
      const res = await DELETE();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Account deleted");
    });

    it("returns 404 when user not found", async () => {
      session.user.id = "507f1f77bcf86cd799439099";
      const res = await DELETE();
      expect(res.status).toBe(404);
    });
  });
});
