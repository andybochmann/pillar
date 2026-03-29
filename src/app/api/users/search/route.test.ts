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

  it("returns matching users who share projects", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    const alice = await createTestUser({ email: "alice@test.com", name: "Alice" });
    const bob = await createTestUser({ email: "bob@test.com", name: "Bob" });

    // Create a project with both current user and alice
    const category = await createTestCategory({ userId: currentUser._id });
    const project = await createTestProject({ categoryId: category._id, userId: currentUser._id });
    await createTestProjectMember({ projectId: project._id, userId: currentUser._id, invitedBy: currentUser._id, role: "owner" });
    await createTestProjectMember({ projectId: project._id, userId: alice._id, invitedBy: currentUser._id, role: "editor" });

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

  it("owners can discover any user by email, even non-members", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    const alice = await createTestUser({ email: "alice@test.com", name: "Alice" });

    // Create a project with only current user as owner
    const category = await createTestCategory({ userId: currentUser._id });
    const project = await createTestProject({ categoryId: category._id, userId: currentUser._id });
    await createTestProjectMember({ projectId: project._id, userId: currentUser._id, invitedBy: currentUser._id, role: "owner" });

    // alice is NOT a member of any project, but owner can still find her
    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe("alice@test.com");
  });

  it("excludes current user from results", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    const category = await createTestCategory({ userId: currentUser._id });
    const project = await createTestProject({ categoryId: category._id, userId: currentUser._id });
    await createTestProjectMember({ projectId: project._id, userId: currentUser._id, invitedBy: currentUser._id, role: "owner" });

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

  it("returns empty when user has no project memberships", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    await createTestUser({ email: "alice@test.com", name: "Alice" });

    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("limits results to 10", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();

    const category = await createTestCategory({ userId: currentUser._id });
    const project = await createTestProject({ categoryId: category._id, userId: currentUser._id });
    await createTestProjectMember({ projectId: project._id, userId: currentUser._id, invitedBy: currentUser._id, role: "owner" });

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

  it("should not return members from projects where caller is only an editor", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    const alice = await createTestUser({ email: "alice@test.com", name: "Alice" });

    // Owner creates a project and invites currentUser as editor + alice as editor
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({ categoryId: category._id, userId: owner._id });
    await createTestProjectMember({ projectId: project._id, userId: owner._id, invitedBy: owner._id, role: "owner" });
    await createTestProjectMember({ projectId: project._id, userId: currentUser._id, invitedBy: owner._id, role: "editor" });
    await createTestProjectMember({ projectId: project._id, userId: alice._id, invitedBy: owner._id, role: "editor" });

    // currentUser is only an editor — should NOT be able to search users from this project
    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(0);
  });

  it("owners can search for any user including non-project-members", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    const alice = await createTestUser({ email: "alice@test.com", name: "Alice" });
    const bob = await createTestUser({ email: "bob@test.com", name: "Bob" });

    const category = await createTestCategory({ userId: currentUser._id });

    // currentUser owns a project — that's all that's needed to enable search
    const project1 = await createTestProject({ categoryId: category._id, userId: currentUser._id });
    await createTestProjectMember({ projectId: project1._id, userId: currentUser._id, invitedBy: currentUser._id, role: "owner" });

    // Both alice and bob are findable — owners can discover new collaborators
    const resAlice = await GET(
      new Request("http://localhost/api/users/search?email=alice"),
    );
    expect(resAlice.status).toBe(200);
    const aliceData = await resAlice.json();
    expect(aliceData).toHaveLength(1);
    expect(aliceData[0].email).toBe("alice@test.com");

    const resBob = await GET(
      new Request("http://localhost/api/users/search?email=bob"),
    );
    expect(resBob.status).toBe(200);
    const bobData = await resBob.json();
    expect(bobData).toHaveLength(1);
    expect(bobData[0].email).toBe("bob@test.com");
  });

  it("is case-insensitive", async () => {
    const currentUser = await createTestUser({ email: "me@test.com" });
    session.user.id = currentUser._id.toString();
    const alice = await createTestUser({ email: "Alice@Test.com", name: "Alice" });

    const category = await createTestCategory({ userId: currentUser._id });
    const project = await createTestProject({ categoryId: category._id, userId: currentUser._id });
    await createTestProjectMember({ projectId: project._id, userId: currentUser._id, invitedBy: currentUser._id, role: "owner" });
    await createTestProjectMember({ projectId: project._id, userId: alice._id, invitedBy: currentUser._id, role: "editor" });

    const res = await GET(
      new Request("http://localhost/api/users/search?email=alice"),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});
