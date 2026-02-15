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
import { GET } from "./route";

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

describe("GET /api/stats/task-counts", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function setupUser() {
    const user = await createTestUser({ email: "stats@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();
  }

  it("returns 401 for unauthenticated request", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/task-counts"),
    );
    expect(res.status).toBe(401);
  });

  it("returns empty counts when no tasks exist", async () => {
    await setupUser();

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/task-counts"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.byCategory).toEqual({});
    expect(data.byProjectAndColumn).toEqual({});
  });

  it("aggregates counts by category and project/column", async () => {
    await setupUser();

    const cat = await createTestCategory({ userId, name: "Work" });
    const catId = cat._id as mongoose.Types.ObjectId;

    const proj = await createTestProject({
      userId,
      categoryId: catId,
      name: "Project A",
    });
    const projId = proj._id as mongoose.Types.ObjectId;

    await createTestTask({ userId, projectId: projId, columnId: "todo" });
    await createTestTask({ userId, projectId: projId, columnId: "todo" });
    await createTestTask({ userId, projectId: projId, columnId: "done" });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/task-counts"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.byCategory[catId.toString()]).toBe(3);
    expect(data.byProjectAndColumn[projId.toString()]).toEqual({
      todo: 2,
      done: 1,
    });
  });

  it("aggregates across multiple categories and projects", async () => {
    await setupUser();

    const cat1 = await createTestCategory({ userId, name: "Work" });
    const cat1Id = cat1._id as mongoose.Types.ObjectId;
    const cat2 = await createTestCategory({ userId, name: "Personal", order: 1 });
    const cat2Id = cat2._id as mongoose.Types.ObjectId;

    const proj1 = await createTestProject({
      userId,
      categoryId: cat1Id,
      name: "Proj 1",
    });
    const proj1Id = proj1._id as mongoose.Types.ObjectId;

    const proj2 = await createTestProject({
      userId,
      categoryId: cat2Id,
      name: "Proj 2",
    });
    const proj2Id = proj2._id as mongoose.Types.ObjectId;

    await createTestTask({ userId, projectId: proj1Id, columnId: "todo" });
    await createTestTask({
      userId,
      projectId: proj1Id,
      columnId: "in-progress",
    });
    await createTestTask({ userId, projectId: proj2Id, columnId: "done" });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/task-counts"),
    );
    const data = await res.json();

    expect(data.byCategory[cat1Id.toString()]).toBe(2);
    expect(data.byCategory[cat2Id.toString()]).toBe(1);
    expect(data.byProjectAndColumn[proj1Id.toString()]).toEqual({
      todo: 1,
      "in-progress": 1,
    });
    expect(data.byProjectAndColumn[proj2Id.toString()]).toEqual({ done: 1 });
  });

  it("excludes archived projects", async () => {
    await setupUser();

    const cat = await createTestCategory({ userId, name: "Work" });
    const catId = cat._id as mongoose.Types.ObjectId;

    const activeProj = await createTestProject({
      userId,
      categoryId: catId,
      name: "Active",
    });
    const archivedProj = await createTestProject({
      userId,
      categoryId: catId,
      name: "Archived",
      archived: true,
    });

    await createTestTask({
      userId,
      projectId: activeProj._id as mongoose.Types.ObjectId,
      columnId: "todo",
    });
    await createTestTask({
      userId,
      projectId: archivedProj._id as mongoose.Types.ObjectId,
      columnId: "todo",
    });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/task-counts"),
    );
    const data = await res.json();

    expect(data.byCategory[catId.toString()]).toBe(1);
    expect(
      data.byProjectAndColumn[
        (archivedProj._id as mongoose.Types.ObjectId).toString()
      ],
    ).toBeUndefined();
  });

  it("isolates counts by user", async () => {
    await setupUser();

    const otherUser = await createTestUser({ email: "other@example.com" });
    const otherUserId = otherUser._id as mongoose.Types.ObjectId;

    const cat = await createTestCategory({ userId, name: "Mine" });
    const catId = cat._id as mongoose.Types.ObjectId;
    const otherCat = await createTestCategory({
      userId: otherUserId,
      name: "Theirs",
    });
    const otherCatId = otherCat._id as mongoose.Types.ObjectId;

    const myProj = await createTestProject({
      userId,
      categoryId: catId,
      name: "My Proj",
    });
    const otherProj = await createTestProject({
      userId: otherUserId,
      categoryId: otherCatId,
      name: "Other Proj",
    });

    await createTestTask({
      userId,
      projectId: myProj._id as mongoose.Types.ObjectId,
      columnId: "todo",
    });
    await createTestTask({
      userId: otherUserId,
      projectId: otherProj._id as mongoose.Types.ObjectId,
      columnId: "todo",
    });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/task-counts"),
    );
    const data = await res.json();

    expect(data.byCategory[catId.toString()]).toBe(1);
    expect(data.byCategory[otherCatId.toString()]).toBeUndefined();
  });
});
