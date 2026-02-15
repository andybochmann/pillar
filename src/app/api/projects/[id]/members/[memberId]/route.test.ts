import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
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
  createTestTask,
} from "@/test/helpers/factories";
import { ProjectMember } from "@/models/project-member";
import { Task } from "@/models/task";

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

import { PATCH, DELETE } from "./route";

describe("PATCH /api/projects/[id]/members/[memberId]", () => {
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

    const ownerMember = await createTestProjectMember({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });
    const editorMember = await createTestProjectMember({
      projectId: project._id,
      userId: editor._id,
      role: "editor",
      invitedBy: owner._id,
    });

    return { owner, editor, category, project, ownerMember, editorMember };
  }

  it("updates member role", async () => {
    const { project, editorMember } = await setupFixtures();

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "viewer" }),
      }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: editorMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe("viewer");
  });

  it("rejects setting role to owner", async () => {
    const { project, editorMember } = await setupFixtures();

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "owner" }),
      }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: editorMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(400);
  });

  it("prevents changing own role", async () => {
    const { project, ownerMember } = await setupFixtures();

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "editor" }),
      }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: ownerMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(400);
  });

  it("returns 403 for non-owner", async () => {
    const { editor, project, ownerMember } = await setupFixtures();
    session.user.id = editor._id.toString();

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "viewer" }),
      }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: ownerMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/projects/[id]/members/[memberId]", () => {
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

    const ownerMember = await createTestProjectMember({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });
    const editorMember = await createTestProjectMember({
      projectId: project._id,
      userId: editor._id,
      role: "editor",
      invitedBy: owner._id,
    });

    return { owner, editor, category, project, ownerMember, editorMember };
  }

  it("owner removes a member", async () => {
    const { project, editorMember } = await setupFixtures();

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: editorMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(200);
    const remaining = await ProjectMember.countDocuments({ projectId: project._id });
    expect(remaining).toBe(1);
  });

  it("member can leave (self-removal)", async () => {
    const { editor, project, editorMember } = await setupFixtures();
    session.user.id = editor._id.toString();

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: editorMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(200);
  });

  it("prevents removing the last owner", async () => {
    const { project, ownerMember } = await setupFixtures();

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: ownerMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Cannot remove the last owner");
  });

  it("clears assigneeId on removed user's tasks", async () => {
    const { editor, project, editorMember } = await setupFixtures();

    const task = await createTestTask({
      projectId: project._id,
      userId: editor._id,
    });
    await Task.updateOne({ _id: task._id }, { assigneeId: editor._id });

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: editorMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(200);
    const updatedTask = await Task.findById(task._id);
    expect(updatedTask!.assigneeId).toBeUndefined();
  });

  it("non-owner cannot remove others", async () => {
    const { editor, project, ownerMember } = await setupFixtures();
    session.user.id = editor._id.toString();

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({
          id: project._id.toString(),
          memberId: ownerMember._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(403);
  });
});
