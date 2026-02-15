import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  createTestUser,
  createTestCategory,
} from "@/test/helpers";
import { Project } from "@/models/project";

describe("Project Model", () => {
  let userId: mongoose.Types.ObjectId;
  let categoryId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    const user = await createTestUser();
    userId = user._id;
    const category = await createTestCategory({ userId });
    categoryId = category._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Project.deleteMany({});
  });

  it("creates a project with default columns", async () => {
    const project = await Project.create({
      name: "My Project",
      categoryId,
      userId,
    });

    expect(project.name).toBe("My Project");
    expect(project.archived).toBe(false);
    expect(project.columns).toHaveLength(4);
    expect(project.columns[0]).toMatchObject({
      id: "todo",
      name: "To Do",
      order: 0,
    });
    expect(project.columns[3]).toMatchObject({
      id: "done",
      name: "Done",
      order: 3,
    });
  });

  it("creates a project with custom columns", async () => {
    const customColumns = [
      { id: "backlog", name: "Backlog", order: 0 },
      { id: "active", name: "Active", order: 1 },
      { id: "complete", name: "Complete", order: 2 },
    ];

    const project = await Project.create({
      name: "Custom Project",
      categoryId,
      userId,
      columns: customColumns,
    });

    expect(project.columns).toHaveLength(3);
    expect(project.columns[0].id).toBe("backlog");
  });

  it("requires name field", async () => {
    await expect(Project.create({ categoryId, userId })).rejects.toThrow(
      /name.*required/i,
    );
  });

  it("requires categoryId field", async () => {
    await expect(Project.create({ name: "Test", userId })).rejects.toThrow(
      /categoryId.*required/i,
    );
  });

  it("requires userId field", async () => {
    await expect(Project.create({ name: "Test", categoryId })).rejects.toThrow(
      /userId.*required/i,
    );
  });

  it("rejects name exceeding maxlength of 100", async () => {
    await expect(
      Project.create({
        name: "x".repeat(101),
        categoryId,
        userId,
      }),
    ).rejects.toThrow();
  });

  it("rejects description exceeding maxlength of 500", async () => {
    await expect(
      Project.create({
        name: "Test",
        description: "x".repeat(501),
        categoryId,
        userId,
      }),
    ).rejects.toThrow();
  });

  it("trims name and description", async () => {
    const project = await Project.create({
      name: "  My Project  ",
      description: "  A description  ",
      categoryId,
      userId,
    });

    expect(project.name).toBe("My Project");
    expect(project.description).toBe("A description");
  });
});
