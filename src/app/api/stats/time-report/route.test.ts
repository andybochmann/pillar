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

const HOUR = 3_600_000;

function req(weeks?: number): NextRequest {
  const url = weeks
    ? `http://localhost:3000/api/stats/time-report?weeks=${weeks}`
    : "http://localhost:3000/api/stats/time-report";
  return new NextRequest(url);
}

// A recent time inside the default 8-week window.
function recent(offsetHours = 0): Date {
  return new Date(Date.now() - offsetHours * HOUR);
}

describe("GET /api/stats/time-report", () => {
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
    const user = await createTestUser({ email: "report@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();
  }

  it("returns 401 for unauthenticated request", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("rejects out-of-bounds weeks", async () => {
    await setupUser();
    const res = await GET(req(99));
    expect(res.status).toBe(400);
  });

  it("returns an empty report when no time is tracked", async () => {
    await setupUser();
    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalMs).toBe(0);
    expect(data.byProject).toEqual([]);
    // byWeek still has one bucket per week in the window.
    expect(data.byWeek).toHaveLength(8);
  });

  it("aggregates the current user's completed sessions by project", async () => {
    await setupUser();
    const cat = await createTestCategory({ userId });
    const proj = await createTestProject({
      userId,
      categoryId: cat._id as mongoose.Types.ObjectId,
      name: "Project A",
    });
    const projId = proj._id as mongoose.Types.ObjectId;
    await createTestProjectMember({
      projectId: projId,
      userId,
      role: "owner",
      invitedBy: userId,
    });

    await createTestTask({
      userId,
      projectId: projId,
      timeSessions: [
        { startedAt: recent(2), endedAt: recent(1), userId }, // 1h
      ],
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalMs).toBe(HOUR);
    expect(data.byProject).toEqual([
      { projectId: projId.toString(), projectName: "Project A", totalMs: HOUR },
    ]);
  });

  it("counts only the caller's own sessions on a shared task", async () => {
    await setupUser();
    const otherUser = await createTestUser({ email: "other@example.com" });
    const otherId = otherUser._id as mongoose.Types.ObjectId;

    const cat = await createTestCategory({ userId });
    const proj = await createTestProject({
      userId,
      categoryId: cat._id as mongoose.Types.ObjectId,
      name: "Shared",
    });
    const projId = proj._id as mongoose.Types.ObjectId;
    await createTestProjectMember({
      projectId: projId,
      userId,
      role: "owner",
      invitedBy: userId,
    });

    await createTestTask({
      userId,
      projectId: projId,
      timeSessions: [
        { startedAt: recent(2), endedAt: recent(1), userId }, // mine: 1h
        { startedAt: recent(5), endedAt: recent(1), userId: otherId }, // theirs: 4h
      ],
    });

    const res = await GET(req());
    const data = await res.json();
    // Only my 1h is counted; the other member's 4h is excluded.
    expect(data.totalMs).toBe(HOUR);
  });

  it("excludes open sessions (no endedAt)", async () => {
    await setupUser();
    const cat = await createTestCategory({ userId });
    const proj = await createTestProject({
      userId,
      categoryId: cat._id as mongoose.Types.ObjectId,
    });
    const projId = proj._id as mongoose.Types.ObjectId;
    await createTestProjectMember({
      projectId: projId,
      userId,
      role: "owner",
      invitedBy: userId,
    });

    await createTestTask({
      userId,
      projectId: projId,
      timeSessions: [{ startedAt: recent(1), userId }], // open
    });

    const res = await GET(req());
    const data = await res.json();
    expect(data.totalMs).toBe(0);
  });

  it("does not count sessions in projects the user cannot access", async () => {
    await setupUser();
    const otherUser = await createTestUser({ email: "stranger@example.com" });
    const otherId = otherUser._id as mongoose.Types.ObjectId;

    const cat = await createTestCategory({ userId: otherId });
    const proj = await createTestProject({
      userId: otherId,
      categoryId: cat._id as mongoose.Types.ObjectId,
    });
    const projId = proj._id as mongoose.Types.ObjectId;
    // No ProjectMember row for our user -> not accessible.

    await createTestTask({
      userId: otherId,
      projectId: projId,
      // Session carries OUR userId, but the project is not accessible to us.
      timeSessions: [{ startedAt: recent(2), endedAt: recent(1), userId }],
    });

    const res = await GET(req());
    const data = await res.json();
    expect(data.totalMs).toBe(0);
  });
});
