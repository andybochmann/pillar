import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
} from "@/test/helpers/db";
import {
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestProjectMember,
} from "@/test/helpers/factories";

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

  it("returns full profile for an exact-email match that is a collaborator", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    const alice = await createTestUser({ email: "alice@test.com", name: "Alice" });

    const category = await createTestCategory({ userId: currentUser._id });
    const project = await createTestProject({ categoryId: category._id, userId: currentUser._id });
    await createTestProjectMember({ projectId: project._id, userId: currentUser._id, invitedBy: currentUser._id, role: "owner" });
    await createTestProjectMember({ projectId: project._id, userId: alice._id, invitedBy: currentUser._id, role: "editor" });

    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice@test.com"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe("alice@test.com");
    expect(data[0].name).toBe("Alice");
    expect(data[0]).not.toHaveProperty("passwordHash");
  });

  it("discloses only id + email for a non-collaborator exact-email match", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    await createTestUser({ email: "alice@test.com", name: "Alice" });

    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice@test.com"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe("alice@test.com");
    // Non-collaborator: name/image must NOT be leaked.
    expect(data[0].name).toBeUndefined();
    expect(data[0].image).toBeUndefined();
  });

  it("does not perform substring / directory enumeration", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    await createTestUser({ email: "alice@test.com", name: "Alice" });
    await createTestUser({ email: "alan@test.com", name: "Alan" });

    // A partial string is not a valid email → no results.
    const res = await GET(
      new Request("http://localhost/api/users/search?email=al"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("excludes the current user even on exact self-email", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    const res = await GET(
      new Request("http://localhost/api/users/search?email=me@test.com"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("returns empty for a non-email query", async () => {
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

  it("returns empty when the exact email does not exist", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    const res = await GET(
      new Request("http://localhost/api/users/search?email=nobody@test.com"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("is case-insensitive on the exact email", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    await createTestUser({ email: "alice@test.com", name: "Alice" });

    const res = await GET(
      new Request("http://localhost/api/users/search?email=ALICE@TEST.COM"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe("alice@test.com");
  });
});
