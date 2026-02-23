import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
  createTestLabel,
  createTestNote,
} from "@/test/helpers";
import { Category } from "@/models/category";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { Label } from "@/models/label";
import { Note } from "@/models/note";
import { NotificationPreference } from "@/models/notification-preference";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "./route";

describe("/api/settings/backup", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  async function seedUser() {
    const user = await createTestUser();
    session.user.id = user._id.toString();
    return user;
  }

  async function seedFullData(userId: mongoose.Types.ObjectId) {
    const label = await createTestLabel({ userId });
    const category = await createTestCategory({ userId });
    const project = await createTestProject({
      categoryId: category._id,
      userId,
    });
    const task = await createTestTask({
      projectId: project._id,
      userId,
      labels: [label._id],
      subtasks: [{ title: "Sub 1", completed: false }],
      statusHistory: [{ columnId: "todo", timestamp: new Date() }],
    });
    const note = await createTestNote({
      parentType: "project",
      projectId: project._id,
      userId,
    });
    await NotificationPreference.create({
      userId,
      enableDailySummary: true,
      timezone: "America/New_York",
    });
    return { label, category, project, task, note };
  }

  describe("GET (export)", () => {
    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns backup JSON with metadata", async () => {
      const user = await seedUser();
      await seedFullData(user._id);

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.metadata).toBeDefined();
      expect(body.metadata.version).toBe(1);
      expect(body.metadata.exportedAt).toBeDefined();
      expect(body.metadata.user.name).toBe(session.user.name);
      expect(body.metadata.user.email).toBe(session.user.email);
    });

    it("returns Content-Disposition attachment header", async () => {
      await seedUser();
      const res = await GET();
      const disposition = res.headers.get("Content-Disposition");
      expect(disposition).toContain("attachment");
      expect(disposition).toContain("pillar-backup");
      expect(disposition).toContain(".json");
    });

    it("exports all entity types", async () => {
      const user = await seedUser();
      await seedFullData(user._id);

      const res = await GET();
      const body = await res.json();

      expect(body.categories).toHaveLength(1);
      expect(body.labels).toHaveLength(1);
      expect(body.projects).toHaveLength(1);
      expect(body.tasks).toHaveLength(1);
      expect(body.notes).toHaveLength(1);
      expect(body.notificationPreference).not.toBeNull();
    });

    it("strips userId and __v from exported entities", async () => {
      const user = await seedUser();
      await seedFullData(user._id);

      const res = await GET();
      const body = await res.json();

      for (const cat of body.categories) {
        expect(cat).not.toHaveProperty("userId");
        expect(cat).not.toHaveProperty("__v");
      }
      for (const proj of body.projects) {
        expect(proj).not.toHaveProperty("userId");
        expect(proj).not.toHaveProperty("__v");
      }
      for (const task of body.tasks) {
        expect(task).not.toHaveProperty("userId");
        expect(task).not.toHaveProperty("__v");
      }
      for (const label of body.labels) {
        expect(label).not.toHaveProperty("userId");
        expect(label).not.toHaveProperty("__v");
      }
      for (const note of body.notes) {
        expect(note).not.toHaveProperty("userId");
        expect(note).not.toHaveProperty("__v");
      }
      if (body.notificationPreference) {
        expect(body.notificationPreference).not.toHaveProperty("userId");
        expect(body.notificationPreference).not.toHaveProperty("__v");
      }
    });

    it("does not include other users data", async () => {
      const user = await seedUser();
      const otherUser = await createTestUser({ email: "other@example.com" });

      await createTestCategory({ userId: user._id, name: "My Category" });
      await createTestCategory({
        userId: otherUser._id,
        name: "Other Category",
      });

      const res = await GET();
      const body = await res.json();

      expect(body.categories).toHaveLength(1);
      expect(body.categories[0].name).toBe("My Category");
    });

    it("returns empty arrays when user has no data", async () => {
      await seedUser();
      const res = await GET();
      const body = await res.json();

      expect(body.categories).toEqual([]);
      expect(body.labels).toEqual([]);
      expect(body.projects).toEqual([]);
      expect(body.tasks).toEqual([]);
      expect(body.notes).toEqual([]);
      expect(body.notificationPreference).toBeNull();
    });

    it("strips assigneeId and timeSessions userId from tasks", async () => {
      const user = await seedUser();
      const category = await createTestCategory({ userId: user._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: user._id,
      });
      const otherUser = await createTestUser({ email: "assignee@example.com" });
      await createTestTask({
        projectId: project._id,
        userId: user._id,
        assigneeId: otherUser._id,
        timeSessions: [
          { startedAt: new Date(), endedAt: new Date(), userId: user._id },
        ],
      });

      const res = await GET();
      const body = await res.json();

      expect(body.tasks[0].timeSessions[0]).not.toHaveProperty("userId");
    });

    it("exports task labels as string IDs", async () => {
      const user = await seedUser();
      const label = await createTestLabel({ userId: user._id });
      const category = await createTestCategory({ userId: user._id });
      const project = await createTestProject({
        categoryId: category._id,
        userId: user._id,
      });
      await createTestTask({
        projectId: project._id,
        userId: user._id,
        labels: [label._id],
      });

      const res = await GET();
      const body = await res.json();

      expect(body.tasks[0].labels[0]).toBe(label._id.toString());
    });
  });

  describe("POST (import)", () => {
    function makeBackup(overrides: Record<string, unknown> = {}) {
      return {
        metadata: {
          version: 1,
          exportedAt: new Date().toISOString(),
          user: { name: "Test User", email: "test@example.com" },
        },
        categories: [],
        labels: [],
        projects: [],
        tasks: [],
        notes: [],
        notificationPreference: null,
        ...overrides,
      };
    }

    function makeRequest(body: unknown) {
      return new NextRequest("http://localhost/api/settings/backup", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    it("returns 401 without session", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const res = await POST(makeRequest(makeBackup()));
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid JSON structure", async () => {
      await seedUser();
      const res = await POST(makeRequest({ foo: "bar" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for wrong metadata version", async () => {
      await seedUser();
      const backup = makeBackup();
      (backup.metadata as Record<string, unknown>).version = 99;
      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid category data", async () => {
      await seedUser();
      const backup = makeBackup({
        categories: [{ name: "" }],
      });
      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(400);
    });

    it("deletes existing user data before importing", async () => {
      const user = await seedUser();
      await seedFullData(user._id);

      // Verify data exists
      expect(await Category.countDocuments({ userId: user._id })).toBe(1);
      expect(await Label.countDocuments({ userId: user._id })).toBe(1);

      const backup = makeBackup();
      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      // All existing data should be deleted
      expect(await Category.countDocuments({ userId: user._id })).toBe(0);
      expect(await Label.countDocuments({ userId: user._id })).toBe(0);
      expect(await Project.countDocuments({ userId: user._id })).toBe(0);
      expect(await Task.countDocuments({ userId: user._id })).toBe(0);
      expect(await Note.countDocuments({ userId: user._id })).toBe(0);
    });

    it("imports labels with fresh IDs", async () => {
      const user = await seedUser();
      const oldId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        labels: [
          { _id: oldId, name: "Bug", color: "#ef4444", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const labels = await Label.find({ userId: user._id });
      expect(labels).toHaveLength(1);
      expect(labels[0].name).toBe("Bug");
      expect(labels[0]._id.toString()).not.toBe(oldId);
    });

    it("imports categories with fresh IDs", async () => {
      const user = await seedUser();
      const backup = makeBackup({
        categories: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const cats = await Category.find({ userId: user._id });
      expect(cats).toHaveLength(1);
      expect(cats[0].name).toBe("Work");
    });

    it("remaps project categoryId to new category IDs", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: "Project A",
            categoryId: oldCatId,
            columns: [
              { id: "todo", name: "To Do", order: 0 },
              { id: "done", name: "Done", order: 1 },
            ],
            viewType: "board",
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const projects = await Project.find({ userId: user._id });
      expect(projects).toHaveLength(1);
      const cats = await Category.find({ userId: user._id });
      expect(projects[0].categoryId.toString()).toBe(cats[0]._id.toString());
    });

    it("remaps task projectId and labels to new IDs", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const oldProjId = new mongoose.Types.ObjectId().toString();
      const oldLabelId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        labels: [
          {
            _id: oldLabelId,
            name: "Bug",
            color: "#ef4444",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: oldProjId,
            name: "Project A",
            categoryId: oldCatId,
            columns: [{ id: "todo", name: "To Do", order: 0 }],
            viewType: "board",
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        tasks: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            title: "Fix bug",
            projectId: oldProjId,
            columnId: "todo",
            priority: "high",
            order: 0,
            labels: [oldLabelId],
            subtasks: [{ title: "Step 1", completed: false }],
            recurrence: { frequency: "none", interval: 1 },
            timeSessions: [],
            statusHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const tasks = await Task.find({ userId: user._id });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Fix bug");

      const projects = await Project.find({ userId: user._id });
      expect(tasks[0].projectId.toString()).toBe(projects[0]._id.toString());

      const labels = await Label.find({ userId: user._id });
      expect(tasks[0].labels[0].toString()).toBe(labels[0]._id.toString());
    });

    it("nulls out assigneeId on imported tasks", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const oldProjId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: oldProjId,
            name: "Project A",
            categoryId: oldCatId,
            columns: [{ id: "todo", name: "To Do", order: 0 }],
            viewType: "board",
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        tasks: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            title: "Assigned task",
            projectId: oldProjId,
            columnId: "todo",
            priority: "medium",
            order: 0,
            labels: [],
            subtasks: [],
            recurrence: { frequency: "none", interval: 1 },
            timeSessions: [],
            statusHistory: [],
            assigneeId: new mongoose.Types.ObjectId().toString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const tasks = await Task.find({ userId: user._id });
      expect(tasks[0].assigneeId).toBeUndefined();
    });

    it("remaps note parentIds based on parentType", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const oldProjId = new mongoose.Types.ObjectId().toString();
      const oldTaskId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: oldProjId,
            name: "Project A",
            categoryId: oldCatId,
            columns: [{ id: "todo", name: "To Do", order: 0 }],
            viewType: "board",
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        tasks: [
          {
            _id: oldTaskId,
            title: "Task",
            projectId: oldProjId,
            columnId: "todo",
            priority: "medium",
            order: 0,
            labels: [],
            subtasks: [],
            recurrence: { frequency: "none", interval: 1 },
            timeSessions: [],
            statusHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        notes: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            title: "Cat Note",
            content: "content",
            parentType: "category",
            categoryId: oldCatId,
            pinned: false,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            _id: new mongoose.Types.ObjectId().toString(),
            title: "Proj Note",
            content: "content",
            parentType: "project",
            projectId: oldProjId,
            pinned: false,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            _id: new mongoose.Types.ObjectId().toString(),
            title: "Task Note",
            content: "content",
            parentType: "task",
            projectId: oldProjId,
            taskId: oldTaskId,
            pinned: false,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const notes = await Note.find({ userId: user._id }).sort("title");
      expect(notes).toHaveLength(3);

      const cats = await Category.find({ userId: user._id });
      const projects = await Project.find({ userId: user._id });
      const tasks = await Task.find({ userId: user._id });

      const catNote = notes.find((n) => n.title === "Cat Note")!;
      expect(catNote.categoryId!.toString()).toBe(cats[0]._id.toString());

      const projNote = notes.find((n) => n.title === "Proj Note")!;
      expect(projNote.projectId!.toString()).toBe(projects[0]._id.toString());

      const taskNote = notes.find((n) => n.title === "Task Note")!;
      expect(taskNote.projectId!.toString()).toBe(projects[0]._id.toString());
      expect(taskNote.taskId!.toString()).toBe(tasks[0]._id.toString());
    });

    it("imports notification preferences", async () => {
      const user = await seedUser();
      const backup = makeBackup({
        notificationPreference: {
          enableInAppNotifications: true,
          enableBrowserPush: false,
          quietHoursEnabled: true,
          quietHoursStart: "23:00",
          quietHoursEnd: "07:00",
          enableOverdueSummary: true,
          overdueSummaryTime: "10:00",
          enableDailySummary: false,
          dailySummaryTime: "09:00",
          dueDateReminders: [{ daysBefore: 1, time: "09:00" }],
          timezone: "Europe/London",
        },
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const pref = await NotificationPreference.findOne({ userId: user._id });
      expect(pref).not.toBeNull();
      expect(pref!.timezone).toBe("Europe/London");
      expect(pref!.quietHoursStart).toBe("23:00");
    });

    it("replaces existing notification preferences on import", async () => {
      const user = await seedUser();
      await NotificationPreference.create({
        userId: user._id,
        timezone: "UTC",
      });

      const backup = makeBackup({
        notificationPreference: {
          enableInAppNotifications: true,
          enableBrowserPush: false,
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          enableOverdueSummary: true,
          overdueSummaryTime: "09:00",
          enableDailySummary: true,
          dailySummaryTime: "09:00",
          dueDateReminders: [],
          timezone: "Asia/Tokyo",
        },
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const prefs = await NotificationPreference.find({ userId: user._id });
      expect(prefs).toHaveLength(1);
      expect(prefs[0].timezone).toBe("Asia/Tokyo");
    });

    it("returns import summary with counts", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        labels: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: "Bug",
            color: "#ef4444",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: "Feature",
            color: "#22c55e",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.summary).toEqual({
        categories: 1,
        labels: 2,
        projects: 0,
        tasks: 0,
        notes: 0,
        notificationPreference: false,
      });
    });

    it("handles import with all empty arrays", async () => {
      await seedUser();
      const backup = makeBackup();
      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.summary).toEqual({
        categories: 0,
        labels: 0,
        projects: 0,
        tasks: 0,
        notes: 0,
        notificationPreference: false,
      });
    });

    it("does not affect other users data during import", async () => {
      const user = await seedUser();
      const otherUser = await createTestUser({ email: "other@example.com" });
      await createTestCategory({ userId: otherUser._id, name: "Other Cat" });

      const backup = makeBackup({
        categories: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: "My Cat",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      // Other user's data should be untouched
      const otherCats = await Category.find({ userId: otherUser._id });
      expect(otherCats).toHaveLength(1);
      expect(otherCats[0].name).toBe("Other Cat");
    });

    it("sets timeSessions userId to importing user", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const oldProjId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: oldProjId,
            name: "Project A",
            categoryId: oldCatId,
            columns: [{ id: "todo", name: "To Do", order: 0 }],
            viewType: "board",
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        tasks: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            title: "Timed task",
            projectId: oldProjId,
            columnId: "todo",
            priority: "medium",
            order: 0,
            labels: [],
            subtasks: [],
            recurrence: { frequency: "none", interval: 1 },
            timeSessions: [
              {
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
              },
            ],
            statusHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const tasks = await Task.find({ userId: user._id });
      expect(tasks[0].timeSessions[0].userId.toString()).toBe(
        user._id.toString(),
      );
    });

    it("imports projects with null viewType as 'board'", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: "Null ViewType Project",
            categoryId: oldCatId,
            columns: [{ id: "todo", name: "To Do", order: 0 }],
            viewType: null,
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const projects = await Project.find({ userId: user._id });
      expect(projects).toHaveLength(1);
      expect(projects[0].viewType).toBe("board");
    });

    it("imports projects with missing viewType as 'board'", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            name: "No ViewType",
            categoryId: oldCatId,
            columns: [{ id: "todo", name: "To Do", order: 0 }],
            // viewType intentionally omitted
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const projects = await Project.find({ userId: user._id });
      expect(projects[0].viewType).toBe("board");
    });

    it("imports notification preferences with missing fields using defaults", async () => {
      const user = await seedUser();
      const backup = makeBackup({
        notificationPreference: {
          enableInAppNotifications: true,
          enableBrowserPush: false,
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          // overdueSummaryTime and enableDailySummary intentionally omitted
          timezone: "America/Chicago",
        },
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const pref = await NotificationPreference.findOne({ userId: user._id });
      expect(pref).not.toBeNull();
      expect(pref!.timezone).toBe("America/Chicago");
      expect(pref!.overdueSummaryTime).toBe("09:00");
      expect(pref!.enableDailySummary).toBe(true);
    });

    it("tolerates extra unknown fields in notification preferences", async () => {
      const user = await seedUser();
      const backup = makeBackup({
        notificationPreference: {
          enableInAppNotifications: true,
          enableBrowserPush: false,
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          enableOverdueSummary: true,
          overdueSummaryTime: "09:00",
          enableDailySummary: true,
          dailySummaryTime: "09:00",
          dueDateReminders: [],
          timezone: "UTC",
          // extra fields from older/newer schema versions
          emailDigestFrequency: "weekly",
          enableEmailDigest: true,
          reminderTimings: [30, 60],
        },
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const pref = await NotificationPreference.findOne({ userId: user._id });
      expect(pref).not.toBeNull();
      expect(pref!.timezone).toBe("UTC");
    });

    it("tolerates extra unknown fields on tasks", async () => {
      const user = await seedUser();
      const oldCatId = new mongoose.Types.ObjectId().toString();
      const oldProjId = new mongoose.Types.ObjectId().toString();
      const backup = makeBackup({
        categories: [
          {
            _id: oldCatId,
            name: "Work",
            color: "#6366f1",
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        projects: [
          {
            _id: oldProjId,
            name: "Project A",
            categoryId: oldCatId,
            columns: [{ id: "todo", name: "To Do", order: 0 }],
            viewType: "board",
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        tasks: [
          {
            _id: new mongoose.Types.ObjectId().toString(),
            title: "Task with extras",
            projectId: oldProjId,
            columnId: "todo",
            priority: "medium",
            order: 0,
            labels: [],
            subtasks: [],
            recurrence: { frequency: "none", interval: 1 },
            timeSessions: [],
            statusHistory: [],
            someUnknownField: "should-be-ignored",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await POST(makeRequest(backup));
      expect(res.status).toBe(200);

      const tasks = await Task.find({ userId: user._id });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Task with extras");
    });

  });

  describe("round-trip (export then import)", () => {
    it("exports and re-imports all data with correct relationships", async () => {
      const user = await seedUser();
      const { label, category, project, task, note } = await seedFullData(
        user._id,
      );

      // Export
      const exportRes = await GET();
      expect(exportRes.status).toBe(200);
      const backup = await exportRes.json();

      // Verify export has the right counts
      expect(backup.categories).toHaveLength(1);
      expect(backup.labels).toHaveLength(1);
      expect(backup.projects).toHaveLength(1);
      expect(backup.tasks).toHaveLength(1);
      expect(backup.notes).toHaveLength(1);
      expect(backup.notificationPreference).not.toBeNull();

      // Import the same backup (this deletes existing data first)
      const importReq = new NextRequest(
        "http://localhost/api/settings/backup",
        {
          method: "POST",
          body: JSON.stringify(backup),
        },
      );
      const importRes = await POST(importReq);
      expect(importRes.status).toBe(200);
      const { summary } = await importRes.json();

      expect(summary).toEqual({
        categories: 1,
        labels: 1,
        projects: 1,
        tasks: 1,
        notes: 1,
        notificationPreference: true,
      });

      // Verify data was restored with correct relationships
      const newCats = await Category.find({ userId: user._id });
      expect(newCats).toHaveLength(1);
      expect(newCats[0].name).toBe(category.name);
      expect(newCats[0]._id.toString()).not.toBe(category._id.toString());

      const newLabels = await Label.find({ userId: user._id });
      expect(newLabels).toHaveLength(1);
      expect(newLabels[0].name).toBe(label.name);

      const newProjects = await Project.find({ userId: user._id });
      expect(newProjects).toHaveLength(1);
      expect(newProjects[0].name).toBe(project.name);
      expect(newProjects[0].categoryId.toString()).toBe(
        newCats[0]._id.toString(),
      );

      const newTasks = await Task.find({ userId: user._id });
      expect(newTasks).toHaveLength(1);
      expect(newTasks[0].title).toBe(task.title);
      expect(newTasks[0].projectId.toString()).toBe(
        newProjects[0]._id.toString(),
      );
      expect(newTasks[0].labels[0].toString()).toBe(
        newLabels[0]._id.toString(),
      );

      const newNotes = await Note.find({ userId: user._id });
      expect(newNotes).toHaveLength(1);
      expect(newNotes[0].title).toBe(note.title);

      const newPref = await NotificationPreference.findOne({
        userId: user._id,
      });
      expect(newPref).not.toBeNull();
      expect(newPref!.timezone).toBe("America/New_York");
    });

    it("can re-import an export twice without errors", async () => {
      const user = await seedUser();
      await seedFullData(user._id);

      const exportRes = await GET();
      const backup = await exportRes.json();

      // First import
      const req1 = new NextRequest("http://localhost/api/settings/backup", {
        method: "POST",
        body: JSON.stringify(backup),
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second import of the same backup
      const req2 = new NextRequest("http://localhost/api/settings/backup", {
        method: "POST",
        body: JSON.stringify(backup),
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(200);

      // Should still have exactly the right counts
      expect(await Category.countDocuments({ userId: user._id })).toBe(1);
      expect(await Label.countDocuments({ userId: user._id })).toBe(1);
      expect(await Project.countDocuments({ userId: user._id })).toBe(1);
      expect(await Task.countDocuments({ userId: user._id })).toBe(1);
      expect(await Note.countDocuments({ userId: user._id })).toBe(1);
    });
  });
});
