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
  createTestTask,
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

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("Projects [id] API", () => {
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
    const user = await createTestUser({ email: "projid@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const cat = await createTestCategory({ userId, name: "Work" });
    categoryId = cat._id as mongoose.Types.ObjectId;
  }

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  describe("GET /api/projects/[id]", () => {
    it("returns a project by id", async () => {
      await setupFixtures();
      const proj = await createTestProject({
        name: "My Project",
        userId,
        categoryId,
      });

      const res = await GET(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`),
        makeParams(proj._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("My Project");
    });

    it("returns 404 for nonexistent project", async () => {
      await setupFixtures();
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await GET(
        new NextRequest(`http://localhost:3000/api/projects/${fakeId}`),
        makeParams(fakeId),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/projects/[id]", () => {
    it("updates project name", async () => {
      await setupFixtures();
      const proj = await createTestProject({
        name: "Old",
        userId,
        categoryId,
      });

      const res = await PATCH(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New" }),
        }),
        makeParams(proj._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("New");
    });

    it("updates columns", async () => {
      await setupFixtures();
      const proj = await createTestProject({
        name: "Board",
        userId,
        categoryId,
        columns: [{ id: "todo", name: "Todo", order: 0 }],
      });

      const newColumns = [
        { id: "todo", name: "Todo", order: 0 },
        { id: "doing", name: "Doing", order: 1 },
        { id: "done", name: "Done", order: 2 },
      ];

      const res = await PATCH(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columns: newColumns }),
        }),
        makeParams(proj._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.columns).toHaveLength(3);
    });

    it("archives a project", async () => {
      await setupFixtures();
      const proj = await createTestProject({
        name: "To Archive",
        userId,
        categoryId,
      });

      const res = await PATCH(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        }),
        makeParams(proj._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.archived).toBe(true);
    });

    it("returns 404 for nonexistent project", async () => {
      await setupFixtures();
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await PATCH(
        new NextRequest(`http://localhost:3000/api/projects/${fakeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "X" }),
        }),
        makeParams(fakeId),
      );
      expect(res.status).toBe(404);
    });

    it("updates viewType", async () => {
      await setupFixtures();
      const proj = await createTestProject({
        name: "Board",
        userId,
        categoryId,
      });

      const res = await PATCH(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewType: "list" }),
        }),
        makeParams(proj._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.viewType).toBe("list");
    });

    it("reassigns orphaned tasks when column is removed", async () => {
      await setupFixtures();
      const proj = await createTestProject({
        name: "Col Test",
        userId,
        categoryId,
        columns: [
          { id: "todo", name: "Todo", order: 0 },
          { id: "in-progress", name: "In Progress", order: 1 },
          { id: "done", name: "Done", order: 2 },
        ],
      });

      // Create a task in the "in-progress" column
      await createTestTask({
        projectId: proj._id as mongoose.Types.ObjectId,
        userId,
        columnId: "in-progress",
        title: "Orphan task",
      });

      // Remove the "in-progress" column
      const newColumns = [
        { id: "todo", name: "Todo", order: 0 },
        { id: "done", name: "Done", order: 1 },
      ];

      const res = await PATCH(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columns: newColumns }),
        }),
        makeParams(proj._id.toString()),
      );
      expect(res.status).toBe(200);

      // Verify the task was moved to the first column ("todo")
      const { Task } = await import("@/models/task");
      const task = await Task.findOne({ title: "Orphan task" });
      expect(task!.columnId).toBe("todo");
    });
  });

  describe("DELETE /api/projects/[id]", () => {
    it("deletes a project", async () => {
      await setupFixtures();
      const proj = await createTestProject({
        name: "To Delete",
        userId,
        categoryId,
      });

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`, {
          method: "DELETE",
        }),
        makeParams(proj._id.toString()),
      );
      expect(res.status).toBe(200);

      // Verify it's gone
      const getRes = await GET(
        new NextRequest(`http://localhost:3000/api/projects/${proj._id}`),
        makeParams(proj._id.toString()),
      );
      expect(getRes.status).toBe(404);
    });
  });
});
