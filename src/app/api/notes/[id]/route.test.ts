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
  createTestNote,
  createTestProjectMember,
} from "@/test/helpers";
import { GET, PATCH, DELETE } from "./route";
import { Note } from "@/models/note";

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

describe("/api/notes/[id]", () => {
  let userId: mongoose.Types.ObjectId;
  let categoryId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

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
    const user = await createTestUser({ email: "test@example.com" });
    userId = user._id;
    session.user.id = userId.toString();
    const category = await createTestCategory({ userId });
    categoryId = category._id;
    const project = await createTestProject({ categoryId, userId });
    projectId = project._id;
    await createTestProjectMember({ projectId, userId, role: "owner", invitedBy: userId });
    return { user, category, project };
  }

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  describe("GET", () => {
    it("returns a note by id", async () => {
      await setupFixtures();
      const note = await createTestNote({
        parentType: "category",
        categoryId,
        userId,
        title: "My Note",
      });

      const req = new NextRequest(`http://localhost/api/notes/${note._id}`);
      const res = await GET(req, makeParams(note._id.toString()));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("My Note");
    });

    it("returns 404 for non-existent note", async () => {
      await setupFixtures();
      const fakeId = new mongoose.Types.ObjectId();
      const req = new NextRequest(`http://localhost/api/notes/${fakeId}`);
      const res = await GET(req, makeParams(fakeId.toString()));
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH", () => {
    it("updates a category note", async () => {
      await setupFixtures();
      const note = await createTestNote({
        parentType: "category",
        categoryId,
        userId,
        title: "Original",
      });

      const req = new NextRequest(`http://localhost/api/notes/${note._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated", pinned: true }),
      });
      const res = await PATCH(req, makeParams(note._id.toString()));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("Updated");
      expect(data.pinned).toBe(true);
    });

    it("updates a project note content", async () => {
      await setupFixtures();
      const note = await createTestNote({
        parentType: "project",
        projectId,
        userId,
        title: "Proj Note",
      });

      const req = new NextRequest(`http://localhost/api/notes/${note._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# Updated content" }),
      });
      const res = await PATCH(req, makeParams(note._id.toString()));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.content).toBe("# Updated content");
    });

    it("returns 404 for non-existent note", async () => {
      await setupFixtures();
      const fakeId = new mongoose.Types.ObjectId();
      const req = new NextRequest(`http://localhost/api/notes/${fakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nope" }),
      });
      const res = await PATCH(req, makeParams(fakeId.toString()));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("deletes a note", async () => {
      await setupFixtures();
      const note = await createTestNote({
        parentType: "category",
        categoryId,
        userId,
        title: "Delete Me",
      });

      const req = new NextRequest(`http://localhost/api/notes/${note._id}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, makeParams(note._id.toString()));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const deleted = await Note.findById(note._id);
      expect(deleted).toBeNull();
    });

    it("returns 404 for non-existent note", async () => {
      await setupFixtures();
      const fakeId = new mongoose.Types.ObjectId();
      const req = new NextRequest(`http://localhost/api/notes/${fakeId}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, makeParams(fakeId.toString()));
      expect(res.status).toBe(404);
    });
  });
});
