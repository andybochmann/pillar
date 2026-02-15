import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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
import {
  getAccessibleProjectIds,
  getProjectRole,
  requireProjectRole,
  getProjectMemberUserIds,
} from "./project-access";

describe("project-access", () => {
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
    const outsider = await createTestUser({ email: "outsider@test.com" });
    const category = await createTestCategory({ userId: owner._id });
    const project = await createTestProject({
      categoryId: category._id,
      userId: owner._id,
    });

    // Create ProjectMember records
    await createTestProjectMember({
      projectId: project._id,
      userId: owner._id,
      role: "owner",
      invitedBy: owner._id,
    });
    await createTestProjectMember({
      projectId: project._id,
      userId: editor._id,
      role: "editor",
      invitedBy: owner._id,
    });

    return { owner, editor, outsider, category, project };
  }

  describe("getAccessibleProjectIds", () => {
    it("returns projects where user is a member", async () => {
      const { owner, project } = await setupFixtures();
      const ids = await getAccessibleProjectIds(owner._id.toString());
      expect(ids).toContain(project._id.toString());
    });

    it("returns projects where user is an editor", async () => {
      const { editor, project } = await setupFixtures();
      const ids = await getAccessibleProjectIds(editor._id.toString());
      expect(ids).toContain(project._id.toString());
    });

    it("does not return projects for non-members", async () => {
      const { outsider, project } = await setupFixtures();
      const ids = await getAccessibleProjectIds(outsider._id.toString());
      expect(ids).not.toContain(project._id.toString());
    });

    it("falls back to Project.userId for non-migrated projects", async () => {
      const owner = await createTestUser({ email: "fallback@test.com" });
      const category = await createTestCategory({ userId: owner._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: owner._id,
      });
      // No ProjectMember records

      const ids = await getAccessibleProjectIds(owner._id.toString());
      expect(ids).toContain(project._id.toString());
    });

    it("includes owned projects even when only other members have records", async () => {
      const owner = await createTestUser({ email: "owner-norec@test.com" });
      const editor = await createTestUser({ email: "editor-norec@test.com" });
      const category = await createTestCategory({ userId: owner._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: owner._id,
      });
      // Only editor has a ProjectMember record — owner does not
      await createTestProjectMember({
        projectId: project._id,
        userId: editor._id,
        role: "editor",
        invitedBy: owner._id,
      });

      const ids = await getAccessibleProjectIds(owner._id.toString());
      expect(ids).toContain(project._id.toString());
    });

    it("returns multiple accessible projects", async () => {
      const { owner, category } = await setupFixtures();
      const project2 = await createTestProject({
        categoryId: category._id,
        userId: owner._id,
        name: "Project 2",
      });
      await createTestProjectMember({
        projectId: project2._id,
        userId: owner._id,
        role: "owner",
        invitedBy: owner._id,
      });

      const ids = await getAccessibleProjectIds(owner._id.toString());
      expect(ids.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getProjectRole", () => {
    it("returns 'owner' for project owner", async () => {
      const { owner, project } = await setupFixtures();
      const role = await getProjectRole(
        owner._id.toString(),
        project._id.toString(),
      );
      expect(role).toBe("owner");
    });

    it("returns 'editor' for project editor", async () => {
      const { editor, project } = await setupFixtures();
      const role = await getProjectRole(
        editor._id.toString(),
        project._id.toString(),
      );
      expect(role).toBe("editor");
    });

    it("returns null for non-members", async () => {
      const { outsider, project } = await setupFixtures();
      const role = await getProjectRole(
        outsider._id.toString(),
        project._id.toString(),
      );
      expect(role).toBeNull();
    });

    it("falls back to 'owner' for non-migrated projects owned by user", async () => {
      const owner = await createTestUser({ email: "fb-owner@test.com" });
      const category = await createTestCategory({ userId: owner._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: owner._id,
      });

      const role = await getProjectRole(
        owner._id.toString(),
        project._id.toString(),
      );
      expect(role).toBe("owner");
    });

    it("returns 'owner' for project creator even when only other members have records", async () => {
      const owner = await createTestUser({ email: "fb-owner-norec@test.com" });
      const editor = await createTestUser({ email: "fb-editor-norec@test.com" });
      const category = await createTestCategory({ userId: owner._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: owner._id,
      });
      // Only editor has a ProjectMember record
      await createTestProjectMember({
        projectId: project._id,
        userId: editor._id,
        role: "editor",
        invitedBy: owner._id,
      });

      const role = await getProjectRole(
        owner._id.toString(),
        project._id.toString(),
      );
      expect(role).toBe("owner");
    });

    it("returns null for non-owner on non-migrated projects", async () => {
      const owner = await createTestUser({ email: "fb-owner2@test.com" });
      const other = await createTestUser({ email: "fb-other@test.com" });
      const category = await createTestCategory({ userId: owner._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: owner._id,
      });

      const role = await getProjectRole(
        other._id.toString(),
        project._id.toString(),
      );
      expect(role).toBeNull();
    });
  });

  describe("requireProjectRole", () => {
    it("returns role when user has sufficient access", async () => {
      const { owner, project } = await setupFixtures();
      const role = await requireProjectRole(
        owner._id.toString(),
        project._id.toString(),
        "owner",
      );
      expect(role).toBe("owner");
    });

    it("allows editor when minimum is editor", async () => {
      const { editor, project } = await setupFixtures();
      const role = await requireProjectRole(
        editor._id.toString(),
        project._id.toString(),
        "editor",
      );
      expect(role).toBe("editor");
    });

    it("allows owner when minimum is editor", async () => {
      const { owner, project } = await setupFixtures();
      const role = await requireProjectRole(
        owner._id.toString(),
        project._id.toString(),
        "editor",
      );
      expect(role).toBe("owner");
    });

    it("allows viewer when minimum is viewer", async () => {
      const { owner, project } = await setupFixtures();
      const viewer = await createTestUser({ email: "viewer@test.com" });
      await createTestProjectMember({
        projectId: project._id,
        userId: viewer._id,
        role: "viewer",
        invitedBy: owner._id,
      });

      const role = await requireProjectRole(
        viewer._id.toString(),
        project._id.toString(),
        "viewer",
      );
      expect(role).toBe("viewer");
    });

    it("allows owner when minimum is viewer", async () => {
      const { owner, project } = await setupFixtures();
      const role = await requireProjectRole(
        owner._id.toString(),
        project._id.toString(),
        "viewer",
      );
      expect(role).toBe("owner");
    });

    it("allows editor when minimum is viewer", async () => {
      const { editor, project } = await setupFixtures();
      const role = await requireProjectRole(
        editor._id.toString(),
        project._id.toString(),
        "viewer",
      );
      expect(role).toBe("editor");
    });

    it("throws 404 for non-members", async () => {
      const { outsider, project } = await setupFixtures();
      await expect(
        requireProjectRole(
          outsider._id.toString(),
          project._id.toString(),
          "editor",
        ),
      ).rejects.toThrow("Project not found");
    });

    it("throws 403 when editor tries to access owner-only action", async () => {
      const { editor, project } = await setupFixtures();
      await expect(
        requireProjectRole(
          editor._id.toString(),
          project._id.toString(),
          "owner",
        ),
      ).rejects.toThrow("Forbidden");
    });

    it("throws 403 when viewer tries to access editor-level action", async () => {
      const { owner, project } = await setupFixtures();
      const viewer = await createTestUser({ email: "viewer2@test.com" });
      await createTestProjectMember({
        projectId: project._id,
        userId: viewer._id,
        role: "viewer",
        invitedBy: owner._id,
      });

      await expect(
        requireProjectRole(
          viewer._id.toString(),
          project._id.toString(),
          "editor",
        ),
      ).rejects.toThrow("Forbidden");
    });

    it("throws 403 when viewer tries to access owner-level action", async () => {
      const { owner, project } = await setupFixtures();
      const viewer = await createTestUser({ email: "viewer3@test.com" });
      await createTestProjectMember({
        projectId: project._id,
        userId: viewer._id,
        role: "viewer",
        invitedBy: owner._id,
      });

      await expect(
        requireProjectRole(
          viewer._id.toString(),
          project._id.toString(),
          "owner",
        ),
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("getProjectMemberUserIds", () => {
    it("returns all member user IDs", async () => {
      const { owner, editor, project } = await setupFixtures();
      const userIds = await getProjectMemberUserIds(project._id.toString());
      expect(userIds).toContain(owner._id.toString());
      expect(userIds).toContain(editor._id.toString());
      expect(userIds.length).toBe(2);
    });

    it("falls back to project owner for non-migrated projects", async () => {
      const owner = await createTestUser({ email: "fb-member@test.com" });
      const category = await createTestCategory({ userId: owner._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: owner._id,
      });

      const userIds = await getProjectMemberUserIds(project._id.toString());
      expect(userIds).toContain(owner._id.toString());
      expect(userIds.length).toBe(1);
    });
  });
});
