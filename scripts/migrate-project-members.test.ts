import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ProjectMember } from "@/models/project-member";
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
import { migrateProjectMembers } from "./migrate-project-members";

describe("migrate-project-members", () => {
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
    const user = await createTestUser({ email: "owner@test.com" });
    const category = await createTestCategory({ userId: user._id });
    return { user, category };
  }

  it("creates ProjectMember for projects without one", async () => {
    const { user, category } = await setupFixtures();
    const project1 = await createTestProject({
      categoryId: category._id,
      userId: user._id,
      name: "Project 1",
    });
    const project2 = await createTestProject({
      categoryId: category._id,
      userId: user._id,
      name: "Project 2",
    });

    const result = await migrateProjectMembers();

    expect(result.processed).toBe(2);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);

    const member1 = await ProjectMember.findOne({
      projectId: project1._id,
      userId: user._id,
    });
    expect(member1).not.toBeNull();
    expect(member1!.role).toBe("owner");
    expect(member1!.invitedBy.toString()).toBe(user._id.toString());

    const member2 = await ProjectMember.findOne({
      projectId: project2._id,
      userId: user._id,
    });
    expect(member2).not.toBeNull();
    expect(member2!.role).toBe("owner");
  });

  it("skips projects that already have a member", async () => {
    const { user, category } = await setupFixtures();
    const project1 = await createTestProject({
      categoryId: category._id,
      userId: user._id,
      name: "Project 1",
    });
    const project2 = await createTestProject({
      categoryId: category._id,
      userId: user._id,
      name: "Project 2",
    });

    // Pre-create a member for project1
    await createTestProjectMember({
      projectId: project1._id,
      userId: user._id,
      role: "owner",
      invitedBy: user._id,
    });

    const result = await migrateProjectMembers();

    expect(result.processed).toBe(2);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);

    // project1 should still have only the original member
    const members1 = await ProjectMember.countDocuments({
      projectId: project1._id,
    });
    expect(members1).toBe(1);

    // project2 should have a new member
    const member2 = await ProjectMember.findOne({
      projectId: project2._id,
      userId: user._id,
    });
    expect(member2).not.toBeNull();
    expect(member2!.role).toBe("owner");
  });

  it("is idempotent — running twice produces the same result", async () => {
    const { user, category } = await setupFixtures();
    await createTestProject({
      categoryId: category._id,
      userId: user._id,
      name: "Project 1",
    });
    await createTestProject({
      categoryId: category._id,
      userId: user._id,
      name: "Project 2",
    });

    // First run
    const result1 = await migrateProjectMembers();
    expect(result1.processed).toBe(2);
    expect(result1.created).toBe(2);
    expect(result1.skipped).toBe(0);

    // Second run
    const result2 = await migrateProjectMembers();
    expect(result2.processed).toBe(2);
    expect(result2.created).toBe(0);
    expect(result2.skipped).toBe(2);

    // Total members should still be 2
    const totalMembers = await ProjectMember.countDocuments({});
    expect(totalMembers).toBe(2);
  });
});
