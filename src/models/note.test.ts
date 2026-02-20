import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers";
import { Note } from "@/models/note";

describe("Note Model", () => {
  let userId: mongoose.Types.ObjectId;
  let categoryId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;
  let taskId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    const user = await createTestUser();
    userId = user._id;
    const category = await createTestCategory({ userId });
    categoryId = category._id;
    const project = await createTestProject({ userId, categoryId });
    projectId = project._id;
    const task = await createTestTask({ userId, projectId, columnId: "todo" });
    taskId = task._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Note.deleteMany({});
  });

  it("creates a category note with valid fields", async () => {
    const note = await Note.create({
      title: "Meeting Notes",
      content: "# Meeting\n\nDiscussed roadmap",
      parentType: "category",
      categoryId,
      userId,
    });

    expect(note.title).toBe("Meeting Notes");
    expect(note.content).toBe("# Meeting\n\nDiscussed roadmap");
    expect(note.parentType).toBe("category");
    expect(note.categoryId?.toString()).toBe(categoryId.toString());
    expect(note.projectId).toBeUndefined();
    expect(note.taskId).toBeUndefined();
    expect(note.pinned).toBe(false);
    expect(note.order).toBe(0);
    expect(note.createdAt).toBeInstanceOf(Date);
    expect(note.updatedAt).toBeInstanceOf(Date);
  });

  it("creates a project note with valid fields", async () => {
    const note = await Note.create({
      title: "Architecture",
      content: "## Design docs",
      parentType: "project",
      projectId,
      userId,
      pinned: true,
    });

    expect(note.title).toBe("Architecture");
    expect(note.parentType).toBe("project");
    expect(note.projectId?.toString()).toBe(projectId.toString());
    expect(note.categoryId).toBeUndefined();
    expect(note.taskId).toBeUndefined();
    expect(note.pinned).toBe(true);
  });

  it("creates a task note with valid fields", async () => {
    const note = await Note.create({
      title: "Implementation Notes",
      parentType: "task",
      projectId,
      taskId,
      userId,
    });

    expect(note.parentType).toBe("task");
    expect(note.taskId?.toString()).toBe(taskId.toString());
    expect(note.projectId?.toString()).toBe(projectId.toString());
    expect(note.categoryId).toBeUndefined();
  });

  it("rejects category note without categoryId", async () => {
    await expect(
      Note.create({
        title: "Bad Note",
        parentType: "category",
        userId,
      }),
    ).rejects.toThrow("categoryId is required for category notes");
  });

  it("rejects project note without projectId", async () => {
    await expect(
      Note.create({
        title: "Bad Note",
        parentType: "project",
        userId,
      }),
    ).rejects.toThrow("projectId is required for project notes");
  });

  it("rejects task note without taskId", async () => {
    await expect(
      Note.create({
        title: "Bad Note",
        parentType: "task",
        projectId,
        userId,
      }),
    ).rejects.toThrow("taskId is required for task notes");
  });

  it("rejects task note without projectId", async () => {
    await expect(
      Note.create({
        title: "Bad Note",
        parentType: "task",
        taskId,
        userId,
      }),
    ).rejects.toThrow("projectId is required for task notes");
  });

  it("requires title", async () => {
    await expect(
      Note.create({
        parentType: "category",
        categoryId,
        userId,
      }),
    ).rejects.toThrow();
  });

  it("enforces title maxlength of 200", async () => {
    await expect(
      Note.create({
        title: "x".repeat(201),
        parentType: "category",
        categoryId,
        userId,
      }),
    ).rejects.toThrow();
  });

  it("enforces content maxlength of 50000", async () => {
    await expect(
      Note.create({
        title: "Long",
        content: "x".repeat(50001),
        parentType: "category",
        categoryId,
        userId,
      }),
    ).rejects.toThrow();
  });

  it("clears unrelated parent fields on category note", async () => {
    const note = await Note.create({
      title: "Clean up",
      parentType: "category",
      categoryId,
      projectId, // should be cleared
      taskId, // should be cleared
      userId,
    });

    expect(note.categoryId?.toString()).toBe(categoryId.toString());
    expect(note.projectId).toBeUndefined();
    expect(note.taskId).toBeUndefined();
  });

  it("defaults content to empty string", async () => {
    const note = await Note.create({
      title: "Empty",
      parentType: "category",
      categoryId,
      userId,
    });

    expect(note.content).toBe("");
  });

  it("sorts by pinned first then order", async () => {
    await Note.create({
      title: "B",
      parentType: "category",
      categoryId,
      userId,
      pinned: false,
      order: 0,
    });
    await Note.create({
      title: "A",
      parentType: "category",
      categoryId,
      userId,
      pinned: true,
      order: 1,
    });
    await Note.create({
      title: "C",
      parentType: "category",
      categoryId,
      userId,
      pinned: false,
      order: 1,
    });

    const notes = await Note.find({ categoryId }).sort({
      pinned: -1,
      order: 1,
    });

    expect(notes[0].title).toBe("A"); // pinned
    expect(notes[1].title).toBe("B"); // order 0
    expect(notes[2].title).toBe("C"); // order 1
  });
});
