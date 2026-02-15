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

vi.mock("@/lib/event-bus", () => ({
  emitSyncEvent: vi.fn(),
}));

import { GET, POST } from "./route";

describe("GET /api/projects/[id]/members", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function setupFixtures() {
    const owner = await createTestUser({ email: "owner@test.com" });
    const editor = await createTestUser({ email: "editor@test.com" });
    session.user.id = owner._id.toString();

    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      categoryId: category._id,
      userId: owner._id,
    });

    await createTestProjectMember({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });
    await createTestProjectMember({
      projectId: project._id,
      userId: editor._id,
      role: "editor",
      invitedBy: owner._id,
    });

    return { owner, editor, category, project };
  }

  it("returns members with populated user data", async () => {
    const { project } = await setupFixtures();

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: project._id.toString() }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0]).toHaveProperty("userName");
    expect(data[0]).toHaveProperty("userEmail");
    expect(data[0]).toHaveProperty("role");
  });

  it("returns 404 for non-member", async () => {
    const { project } = await setupFixtures();
    const outsider = await createTestUser({ email: "outsider@test.com" });
    session.user.id = outsider._id.toString();

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: project._id.toString() }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated", async () => {
    session.user.id = "";
    const originalAuth = (await import("@/lib/auth")).auth as ReturnType<typeof vi.fn>;
    originalAuth.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "someid" }),
    });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/projects/[id]/members", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function setupFixtures() {
    const owner = await createTestUser({ email: "owner@test.com" });
    const newUser = await createTestUser({ email: "new@test.com" });
    session.user.id = owner._id.toString();

    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      categoryId: category._id,
      userId: owner._id,
    });

    await createTestProjectMember({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });

    return { owner, newUser, category, project };
  }

  it("adds a member by email", async () => {
    const { project } = await setupFixtures();

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@test.com", role: "editor" }),
      }),
      { params: Promise.resolve({ id: project._id.toString() }) },
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.role).toBe("editor");
    expect(data.userEmail).toBe("new@test.com");
  });

  it("returns 404 for non-existent user email", async () => {
    const { project } = await setupFixtures();

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@test.com", role: "editor" }),
      }),
      { params: Promise.resolve({ id: project._id.toString() }) },
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 for already a member", async () => {
    const { owner, project } = await setupFixtures();

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@test.com", role: "editor" }),
      }),
      { params: Promise.resolve({ id: project._id.toString() }) },
    );

    expect(res.status).toBe(409);
  });

  it("returns 403 for non-owner trying to add member", async () => {
    const { project } = await setupFixtures();
    const editor = await createTestUser({ email: "editor@test.com" });
    await createTestProjectMember({
      projectId: project._id,
      userId: editor._id,
      role: "editor",
      invitedBy: session.user.id as unknown as import("mongoose").Types.ObjectId,
    });
    session.user.id = editor._id.toString();

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@test.com", role: "editor" }),
      }),
      { params: Promise.resolve({ id: project._id.toString() }) },
    );

    expect(res.status).toBe(403);
  });

  it("validates request body", async () => {
    const { project } = await setupFixtures();

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      { params: Promise.resolve({ id: project._id.toString() }) },
    );

    expect(res.status).toBe(400);
  });
});
