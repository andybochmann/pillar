import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { ProjectMember } from "./project-member";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
} from "@/test/helpers/db";
import {
  createTestUser,
  createTestCategory,
  createTestProject,
} from "@/test/helpers/factories";

describe("ProjectMember model", () => {
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
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      categoryId: category._id,
      userId: owner._id,
    });
    return { owner, editor, category, project };
  }

  it("creates a valid project member", async () => {
    const { owner, project } = await setupFixtures();

    const member = await ProjectMember.create({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });

    expect(member.projectId.toString()).toBe(project._id.toString());
    expect(member.userId.toString()).toBe(owner._id.toString());
    expect(member.role).toBe("owner");
    expect(member.invitedBy.toString()).toBe(owner._id.toString());
    expect(member.createdAt).toBeDefined();
    expect(member.updatedAt).toBeDefined();
  });

  it("requires projectId", async () => {
    const { owner } = await setupFixtures();

    await expect(
      ProjectMember.create({
        userId: owner._id,
        role: "owner",
        invitedBy: owner._id,
      }),
    ).rejects.toThrow();
  });

  it("requires userId", async () => {
    const { owner, project } = await setupFixtures();

    await expect(
      ProjectMember.create({
        projectId: project._id,
        role: "owner",
        invitedBy: owner._id,
      }),
    ).rejects.toThrow();
  });

  it("requires role", async () => {
    const { owner, project } = await setupFixtures();

    await expect(
      ProjectMember.create({
        projectId: project._id,
        userId: owner._id,
        invitedBy: owner._id,
      }),
    ).rejects.toThrow();
  });

  it("requires invitedBy", async () => {
    const { owner, project } = await setupFixtures();

    await expect(
      ProjectMember.create({
        projectId: project._id,
        userId: owner._id,
        role: "owner",
      }),
    ).rejects.toThrow();
  });

  it("validates role enum", async () => {
    const { owner, project } = await setupFixtures();

    await expect(
      ProjectMember.create({
        projectId: project._id,
        userId: owner._id,
        role: "admin",
        invitedBy: owner._id,
      }),
    ).rejects.toThrow();
  });

  it("accepts viewer role", async () => {
    const { owner, editor, project } = await setupFixtures();

    const member = await ProjectMember.create({
      projectId: project._id,
      userId: editor._id,
      role: "viewer",
      invitedBy: owner._id,
    });

    expect(member.role).toBe("viewer");
  });

  it("enforces unique compound index on projectId + userId", async () => {
    const { owner, project } = await setupFixtures();

    await ProjectMember.create({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });

    await expect(
      ProjectMember.create({
        projectId: project._id,
        userId: owner._id,
        role: "editor",
        invitedBy: owner._id,
      }),
    ).rejects.toThrow();
  });

  it("allows same user in different projects", async () => {
    const { owner, category } = await setupFixtures();
    const project1 = await createTestProject({
      categoryId: category._id,
      userId: owner._id,
      name: "Project 1",
    });
    const project2 = await createTestProject({
      categoryId: category._id,
      userId: owner._id,
      name: "Project 2",
    });

    const member1 = await ProjectMember.create({
      projectId: project1._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });
    const member2 = await ProjectMember.create({
      projectId: project2._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });

    expect(member1._id).not.toEqual(member2._id);
  });

  it("allows different users in the same project", async () => {
    const { owner, editor, project } = await setupFixtures();

    await ProjectMember.create({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });

    const editorMember = await ProjectMember.create({
      projectId: project._id,
      userId: editor._id,
      role: "editor",
      invitedBy: owner._id,
    });

    expect(editorMember.role).toBe("editor");
    const count = await ProjectMember.countDocuments({
      projectId: project._id,
    });
    expect(count).toBe(2);
  });

  it("populates user references", async () => {
    const { owner, project } = await setupFixtures();

    await ProjectMember.create({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });

    const populated = await ProjectMember.findOne({
      projectId: project._id,
    }).populate("userId", "name email image");

    const user = populated!.userId as unknown as {
      name: string;
      email: string;
    };
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("owner@test.com");
  });
});
