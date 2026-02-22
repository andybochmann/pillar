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
  createTestProjectMember,
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

describe("GET /api/stats/overdue-count", () => {
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
    const user = await createTestUser({ email: "overdue@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId, name: "Work" });
    categoryId = category._id as mongoose.Types.ObjectId;

    const project = await createTestProject({
      userId,
      categoryId,
      name: "Test Project",
    });
    projectId = project._id as mongoose.Types.ObjectId;
    await createTestProjectMember({ projectId, userId, role: "owner", invitedBy: userId });
  }

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/overdue-count"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 0 when no overdue tasks", async () => {
    await setupFixtures();

    // Task with future due date
    await createTestTask({
      userId,
      projectId,
      dueDate: new Date(Date.now() + 86400000 * 7),
    });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/overdue-count"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });

  it("returns correct count with overdue tasks", async () => {
    await setupFixtures();

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    // Two overdue tasks (past due, not completed)
    await createTestTask({
      userId,
      projectId,
      title: "Overdue 1",
      dueDate: pastDate,
    });
    await createTestTask({
      userId,
      projectId,
      title: "Overdue 2",
      dueDate: pastDate,
    });

    // One future task (not overdue)
    await createTestTask({
      userId,
      projectId,
      title: "Future",
      dueDate: new Date(Date.now() + 86400000 * 7),
    });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/overdue-count"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(2);
  });

  it("excludes completed tasks", async () => {
    await setupFixtures();

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    // Overdue but completed
    await createTestTask({
      userId,
      projectId,
      title: "Completed overdue",
      dueDate: pastDate,
      completedAt: new Date(),
    });

    // Overdue and not completed
    await createTestTask({
      userId,
      projectId,
      title: "Still overdue",
      dueDate: pastDate,
    });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/overdue-count"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
  });

  it("excludes tasks from archived projects", async () => {
    await setupFixtures();

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    // Overdue task in active project
    await createTestTask({
      userId,
      projectId,
      title: "Active overdue",
      dueDate: pastDate,
    });

    // Overdue task in archived project
    const archivedProject = await createTestProject({
      userId,
      categoryId,
      name: "Archived Project",
      archived: true,
    });
    await createTestProjectMember({ projectId: archivedProject._id as mongoose.Types.ObjectId, userId, role: "owner", invitedBy: userId });
    await createTestTask({
      userId,
      projectId: archivedProject._id as mongoose.Types.ObjectId,
      title: "Archived overdue",
      dueDate: pastDate,
    });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/overdue-count"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
  });

  it("excludes tasks with future due dates", async () => {
    await setupFixtures();

    // Task due tomorrow
    await createTestTask({
      userId,
      projectId,
      title: "Due tomorrow",
      dueDate: new Date(Date.now() + 86400000),
    });

    // Task with no due date
    await createTestTask({
      userId,
      projectId,
      title: "No due date",
    });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/stats/overdue-count"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });
});
