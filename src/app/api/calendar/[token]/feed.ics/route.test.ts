import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
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
import type { IUser } from "@/models/user";
import type { IProject } from "@/models/project";

// NOTE: This route is intentionally PUBLIC (no auth mock) — external calendar
// clients authenticate via the secret token in the URL.

import { GET } from "./route";

const TOKEN = "c".repeat(64);

function feedRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/calendar/${TOKEN}/feed.ics`);
}

function ctx(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/calendar/[token]/feed.ics", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  async function seedProject(user: IUser): Promise<IProject> {
    const category = await createTestCategory({ userId: user._id });
    return createTestProject({ categoryId: category._id, userId: user._id });
  }

  async function seedUserWithToken(): Promise<IUser> {
    const user = await createTestUser();
    user.calendarFeedToken = TOKEN;
    await user.save();
    return user;
  }

  it("returns 404 for a malformed token without hitting the DB", async () => {
    const res = await GET(feedRequest(), ctx("not-a-real-token"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when no user matches the token", async () => {
    const res = await GET(feedRequest(), ctx("d".repeat(64)));
    expect(res.status).toBe(404);
  });

  it("returns a valid calendar with the right headers", async () => {
    const user = await seedUserWithToken();
    const project = await seedProject(user);
    await createTestTask({
      title: "Pay taxes",
      projectId: project._id,
      userId: user._id,
      dueDate: new Date("2026-07-11T00:00:00.000Z"),
    });

    const res = await GET(feedRequest(), ctx(TOKEN));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(res.headers.get("Content-Disposition")).toContain(".ics");

    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:Pay taxes");
    expect(body).toContain("DTSTART;VALUE=DATE:20260711");
  });

  it("includes only tasks that have a due date", async () => {
    const user = await seedUserWithToken();
    const project = await seedProject(user);
    await createTestTask({
      title: "Has due date",
      projectId: project._id,
      userId: user._id,
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    await createTestTask({
      title: "No due date",
      projectId: project._id,
      userId: user._id,
    });

    const body = await (await GET(feedRequest(), ctx(TOKEN))).text();
    expect(body).toContain("SUMMARY:Has due date");
    expect(body).not.toContain("SUMMARY:No due date");
  });

  it("excludes archived tasks", async () => {
    const user = await seedUserWithToken();
    const project = await seedProject(user);
    await createTestTask({
      title: "Archived task",
      projectId: project._id,
      userId: user._id,
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
      archived: true,
    });

    const body = await (await GET(feedRequest(), ctx(TOKEN))).text();
    expect(body).not.toContain("SUMMARY:Archived task");
  });

  it("only includes the owner's tasks, not other users' tasks", async () => {
    const owner = await seedUserWithToken();
    const project = await seedProject(owner);
    await createTestTask({
      title: "Owner task",
      projectId: project._id,
      userId: owner._id,
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
    });

    const other = await createTestUser({ email: "other@example.com" });
    const otherProject = await seedProject(other);
    await createTestTask({
      title: "Other user task",
      projectId: otherProject._id,
      userId: other._id,
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
    });

    const body = await (await GET(feedRequest(), ctx(TOKEN))).text();
    expect(body).toContain("SUMMARY:Owner task");
    expect(body).not.toContain("SUMMARY:Other user task");
  });

  it("escapes special characters in task titles (ICS injection safety)", async () => {
    const user = await seedUserWithToken();
    const project = await seedProject(user);
    await createTestTask({
      title: "Plan A, B; go",
      projectId: project._id,
      userId: user._id,
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
    });

    const body = await (await GET(feedRequest(), ctx(TOKEN))).text();
    expect(body).toContain("SUMMARY:Plan A\\, B\\; go");
  });

  it("returns a valid empty calendar when the user has no dated tasks", async () => {
    await seedUserWithToken();
    const res = await GET(feedRequest(), ctx(TOKEN));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).not.toContain("BEGIN:VEVENT");
  });
});
