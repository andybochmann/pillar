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
  createTestProject,
  createTestProjectMember,
} from "@/test/helpers";
import { GET, POST } from "./route";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("Projects API", () => {
  let userId: mongoose.Types.ObjectId;
  let categoryId: mongoose.Types.ObjectId;

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
    const user = await createTestUser({ email: "proj@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const cat = await createTestCategory({ userId, name: "Work" });
    categoryId = cat._id as mongoose.Types.ObjectId;
  }

  function createRequest(url: string, init?: RequestInit) {
    return new NextRequest(`http://localhost:3000${url}`, init);
  }

  describe("GET /api/projects", () => {
    it("returns non-archived projects by default", async () => {
      await setupFixtures();
      const p1 = await createTestProject({ name: "Active", userId, categoryId });
      await createTestProjectMember({ projectId: p1._id as mongoose.Types.ObjectId, userId, role: "owner", invitedBy: userId });
      const p2 = await createTestProject({
        name: "Archived",
        userId,
        categoryId,
        archived: true,
      });
      await createTestProjectMember({ projectId: p2._id as mongoose.Types.ObjectId, userId, role: "owner", invitedBy: userId });

      const res = await GET(createRequest("/api/projects"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Active");
    });

    it("returns all projects when includeArchived=true", async () => {
      await setupFixtures();
      const p1 = await createTestProject({ name: "Active", userId, categoryId });
      await createTestProjectMember({ projectId: p1._id as mongoose.Types.ObjectId, userId, role: "owner", invitedBy: userId });
      const p2 = await createTestProject({
        name: "Archived",
        userId,
        categoryId,
        archived: true,
      });
      await createTestProjectMember({ projectId: p2._id as mongoose.Types.ObjectId, userId, role: "owner", invitedBy: userId });

      const res = await GET(
        createRequest("/api/projects?includeArchived=true"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    it("filters by categoryId", async () => {
      await setupFixtures();
      const cat2 = await createTestCategory({ userId, name: "Personal" });
      const p1 = await createTestProject({ name: "P1", userId, categoryId });
      await createTestProjectMember({ projectId: p1._id as mongoose.Types.ObjectId, userId, role: "owner", invitedBy: userId });
      const p2 = await createTestProject({
        name: "P2",
        userId,
        categoryId: cat2._id as mongoose.Types.ObjectId,
      });
      await createTestProjectMember({ projectId: p2._id as mongoose.Types.ObjectId, userId, role: "owner", invitedBy: userId });

      const res = await GET(
        createRequest(`/api/projects?categoryId=${categoryId}`),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("P1");
    });

    it("returns 401 when unauthorized", async () => {
      const { auth } = await import("@/lib/auth");
      vi.mocked(auth).mockResolvedValueOnce(null);

      const res = await GET(createRequest("/api/projects"));
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/projects", () => {
    it("creates a project with default columns", async () => {
      await setupFixtures();
      const res = await POST(
        createRequest("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "New Project",
            categoryId: categoryId.toString(),
          }),
        }),
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("New Project");
    });

    it("returns 400 for missing name", async () => {
      await setupFixtures();
      const res = await POST(
        createRequest("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: categoryId.toString() }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing categoryId", async () => {
      await setupFixtures();
      const res = await POST(
        createRequest("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test" }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("creates a list project with list default columns", async () => {
      await setupFixtures();
      const res = await POST(
        createRequest("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Shopping List",
            categoryId: categoryId.toString(),
            viewType: "list",
          }),
        }),
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.viewType).toBe("list");
      expect(data.columns).toHaveLength(2);
      expect(data.columns[0].id).toBe("todo");
      expect(data.columns[1].id).toBe("done");
    });

    it("creates a board project with default viewType", async () => {
      await setupFixtures();
      const res = await POST(
        createRequest("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Board Project",
            categoryId: categoryId.toString(),
          }),
        }),
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.viewType).toBe("board");
      expect(data.columns).toHaveLength(4);
    });
  });
});
