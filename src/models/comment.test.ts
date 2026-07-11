import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB } from "@/test/helpers";
import { Comment } from "./comment";

describe("Comment model", () => {
  const taskId = new mongoose.Types.ObjectId();
  const projectId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Comment.deleteMany({});
  });

  it("creates a comment with required fields", async () => {
    const comment = await Comment.create({
      taskId,
      projectId,
      userId,
      body: "Looks good to me",
    });

    expect(comment.body).toBe("Looks good to me");
    expect(comment.taskId.toString()).toBe(taskId.toString());
    expect(comment.projectId.toString()).toBe(projectId.toString());
    expect(comment.mentions).toEqual([]);
    expect(comment.createdAt).toBeInstanceOf(Date);
    expect(comment.updatedAt).toBeInstanceOf(Date);
  });

  it("trims the body", async () => {
    const comment = await Comment.create({
      taskId,
      projectId,
      userId,
      body: "   spaced   ",
    });
    expect(comment.body).toBe("spaced");
  });

  it("requires a body", async () => {
    await expect(
      Comment.create({ taskId, projectId, userId }),
    ).rejects.toThrow();
  });

  it("requires taskId and projectId", async () => {
    await expect(
      Comment.create({ userId, body: "orphan" }),
    ).rejects.toThrow();
  });

  it("rejects a body over 5000 characters", async () => {
    await expect(
      Comment.create({
        taskId,
        projectId,
        userId,
        body: "x".repeat(5001),
      }),
    ).rejects.toThrow();
  });

  it("stores mentions as ObjectIds", async () => {
    const m1 = new mongoose.Types.ObjectId();
    const comment = await Comment.create({
      taskId,
      projectId,
      userId,
      body: "cc @someone",
      mentions: [m1],
    });
    expect(comment.mentions).toHaveLength(1);
    expect(comment.mentions[0].toString()).toBe(m1.toString());
  });
});
