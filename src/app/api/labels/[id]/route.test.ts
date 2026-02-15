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
  createTestLabel,
  createTestCategory,
  createTestProject,
  createTestTask,
} from "@/test/helpers";
import { PATCH, DELETE } from "./route";

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

describe("Labels [id] API", () => {
  let userId: mongoose.Types.ObjectId;
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

  async function setupUser() {
    const user = await createTestUser({ email: "label-id@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();

    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      userId,
      categoryId: category._id as mongoose.Types.ObjectId,
    });
    projectId = project._id as mongoose.Types.ObjectId;
  }

  function patchRequest(id: string, body: Record<string, unknown>) {
    return new NextRequest(`http://localhost:3000/api/labels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function deleteRequest(id: string) {
    return new NextRequest(`http://localhost:3000/api/labels/${id}`, {
      method: "DELETE",
    });
  }

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  describe("PATCH /api/labels/[id]", () => {
    it("updates label color", async () => {
      await setupUser();
      const label = await createTestLabel({ userId, name: "Bug" });

      const res = await PATCH(
        patchRequest(label._id.toString(), { color: "#3b82f6" }),
        makeParams(label._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.color).toBe("#3b82f6");
    });

    it("renames label without cascading to tasks (tasks reference by ID)", async () => {
      await setupUser();
      const label = await createTestLabel({ userId, name: "Bug" });
      await createTestTask({
        userId,
        projectId,
        labels: [label._id],
      });

      const res = await PATCH(
        patchRequest(label._id.toString(), { name: "Defect" }),
        makeParams(label._id.toString()),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("Defect");

      // Verify task still references the same label ID (no cascade needed)
      const { Task } = await import("@/models/task");
      const task = await Task.findOne({ userId });
      expect(task!.labels.map((l) => l.toString())).toContain(
        label._id.toString(),
      );
    });

    it("returns 409 when renaming to existing name", async () => {
      await setupUser();
      const label = await createTestLabel({ userId, name: "Bug" });
      await createTestLabel({ userId, name: "Feature", color: "#3b82f6" });

      const res = await PATCH(
        patchRequest(label._id.toString(), { name: "Feature" }),
        makeParams(label._id.toString()),
      );
      expect(res.status).toBe(409);
    });

    it("returns 404 for non-existent label", async () => {
      await setupUser();
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await PATCH(
        patchRequest(fakeId, { color: "#3b82f6" }),
        makeParams(fakeId),
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid color", async () => {
      await setupUser();
      const label = await createTestLabel({ userId, name: "Bug" });

      const res = await PATCH(
        patchRequest(label._id.toString(), { color: "bad" }),
        makeParams(label._id.toString()),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/labels/[id]", () => {
    it("deletes label and removes ID from tasks", async () => {
      await setupUser();
      const label = await createTestLabel({ userId, name: "Bug" });
      const featureLabel = await createTestLabel({
        userId,
        name: "Feature",
        color: "#3b82f6",
      });
      await createTestTask({
        userId,
        projectId,
        labels: [label._id, featureLabel._id],
      });

      const res = await DELETE(
        deleteRequest(label._id.toString()),
        makeParams(label._id.toString()),
      );
      expect(res.status).toBe(200);

      // Verify label is gone
      const { Label } = await import("@/models/label");
      const found = await Label.findById(label._id);
      expect(found).toBeNull();

      // Verify task label ID was removed but other label remains
      const { Task } = await import("@/models/task");
      const task = await Task.findOne({ userId });
      const labelIds = task!.labels.map((l) => l.toString());
      expect(labelIds).not.toContain(label._id.toString());
      expect(labelIds).toContain(featureLabel._id.toString());
    });

    it("returns 404 for non-existent label", async () => {
      await setupUser();
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await DELETE(deleteRequest(fakeId), makeParams(fakeId));
      expect(res.status).toBe(404);
    });
  });
});
