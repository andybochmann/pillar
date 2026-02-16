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
import { Account } from "@/models/account";
import { PATCH } from "./route";

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

describe("PATCH /api/settings/password", () => {
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

  it("returns 401 without session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/settings/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "old",
        newPassword: "newpass123",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("changes password with correct current password", async () => {
    await seedUser();
    const req = new NextRequest("http://localhost/api/settings/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "TestPass123!",
        newPassword: "NewPassword456!",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Password updated");
  });

  it("rejects wrong current password", async () => {
    await seedUser();
    const req = new NextRequest("http://localhost/api/settings/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "WrongPassword",
        newPassword: "NewPassword456!",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Current password is incorrect");
  });

  it("validates new password length", async () => {
    await seedUser();
    const req = new NextRequest("http://localhost/api/settings/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "TestPass123!",
        newPassword: "short",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  describe("set password (OAuth user)", () => {
    async function seedOAuthUser() {
      const user = await User.create({
        name: "OAuth User",
        email: "oauth@example.com",
      });
      session.user.id = user._id.toString();
      return user;
    }

    it("sets password for OAuth user without currentPassword", async () => {
      await seedOAuthUser();
      const req = new NextRequest("http://localhost/api/settings/password", {
        method: "PATCH",
        body: JSON.stringify({ newPassword: "NewPassword123!" }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Password updated");

      const updated = await User.findById(session.user.id);
      expect(updated?.passwordHash).toBeDefined();
    });

    it("creates credentials Account when setting password", async () => {
      const user = await seedOAuthUser();
      const req = new NextRequest("http://localhost/api/settings/password", {
        method: "PATCH",
        body: JSON.stringify({ newPassword: "NewPassword123!" }),
      });
      await PATCH(req);

      const account = await Account.findOne({
        userId: user._id,
        provider: "credentials",
      });
      expect(account).not.toBeNull();
    });

    it("validates new password length for OAuth user", async () => {
      await seedOAuthUser();
      const req = new NextRequest("http://localhost/api/settings/password", {
        method: "PATCH",
        body: JSON.stringify({ newPassword: "short" }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });
  });
});
