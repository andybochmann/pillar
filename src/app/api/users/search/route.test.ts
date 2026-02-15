import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
} from "@/test/helpers/db";
import { createTestUser } from "@/test/helpers/factories";

const session = vi.hoisted(() => ({
  user: { id: "000000000000000000000000", name: "Test User", email: "test@example.com" },
  expires: "2099-01-01",
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

import { GET } from "./route";

describe("GET /api/users/search", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it("returns matching users by email", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    await createTestUser({ email: "alice@test.com", name: "Alice" });
    await createTestUser({ email: "bob@test.com", name: "Bob" });

    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe("alice@test.com");
    expect(data[0].name).toBe("Alice");
    expect(data[0]).not.toHaveProperty("passwordHash");
  });

  it("excludes current user from results", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    const res = await GET(
      new Request("http://localhost/api/users/search?email=me@test"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("returns empty for short queries", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    const res = await GET(
      new Request("http://localhost/api/users/search?email=a"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("returns empty when no email param", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    const res = await GET(
      new Request("http://localhost/api/users/search"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("limits results to 10", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    for (let i = 0; i < 15; i++) {
      await createTestUser({ email: `user${i}@search.com` });
    }

    const res = await GET(
      new Request("http://localhost/api/users/search?email=search.com"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(10);
  });

  it("is case-insensitive", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    await createTestUser({ email: "Alice@Test.com", name: "Alice" });

    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});
