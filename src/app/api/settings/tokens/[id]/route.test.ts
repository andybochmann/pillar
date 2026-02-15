import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
} from "@/test/helpers";
import { AccessToken } from "@/models/access-token";

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

import { DELETE } from "./route";

describe("DELETE /api/settings/tokens/[id]", () => {
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
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }),
    });
    expect(res.status).toBe(401);
  });

  it("revokes token and returns success", async () => {
    const user = await seedUser();
    const token = await AccessToken.create({
      userId: user._id,
      name: "Test Token",
      tokenHash: "hash_to_delete",
      tokenPrefix: "plt_aaaa",
    });

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: token._id.toString() }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const found = await AccessToken.findById(token._id);
    expect(found).toBeNull();
  });

  it("returns 404 for non-existent token", async () => {
    await seedUser();
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "507f1f77bcf86cd799439099" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for other user's token", async () => {
    await seedUser();
    const other = await createTestUser({ email: "other@example.com" });
    const token = await AccessToken.create({
      userId: other._id,
      name: "Other Token",
      tokenHash: "hash_other_user",
      tokenPrefix: "plt_oooo",
    });

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: token._id.toString() }),
    });
    expect(res.status).toBe(404);
  });
});
