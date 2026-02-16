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
import {
  setupTestDB,
  teardownTestDB,
  createTestUser,
  createTestCategory,
  createTestProject,
  createTestTask,
  createTestLabel,
} from "@/test/helpers";
import { Task } from "@/models/task";
import { Project } from "@/models/project";
import { Category } from "@/models/category";
import { Label } from "@/models/label";
import type {
  LeanTask,
  LeanProject,
  LeanCategory,
  LeanLabel,
  LeanSubtask,
  LeanStatusHistoryEntry,
  LeanColumn,
  SerializedColumn,
} from "@/lib/mcp-tools/types";

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Helper to serialize a task like tasks.ts does
 */
function serializeTask(task: LeanTask) {
  return {
    _id: task._id.toString(),
    title: task.title,
    description: task.description,
    projectId: task.projectId.toString(),
    userId: task.userId.toString(),
    assigneeId: task.assigneeId ? task.assigneeId.toString() : null,
    columnId: task.columnId,
    priority: task.priority,
    dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : null,
    reminderAt: task.reminderAt instanceof Date ? task.reminderAt.toISOString() : null,
    recurrence: {
      frequency: task.recurrence.frequency,
      interval: task.recurrence.interval,
      endDate:
        task.recurrence.endDate instanceof Date
          ? task.recurrence.endDate.toISOString()
          : null,
    },
    order: task.order,
    labels: task.labels.map((id: mongoose.Types.ObjectId) => id.toString()),
    subtasks: task.subtasks.map((s: LeanSubtask) => ({
      _id: s._id.toString(),
      title: s.title,
      completed: s.completed,
    })),
    statusHistory: task.statusHistory.map((h: LeanStatusHistoryEntry) => ({
      columnId: h.columnId,
      timestamp: h.timestamp.toISOString(),
    })),
    completedAt:
      task.completedAt instanceof Date ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/**
 * Helper to serialize a project like projects.ts does
 */
function serializeProject(project: LeanProject) {
  return {
    _id: project._id.toString(),
    name: project.name,
    description: project.description,
    categoryId: project.categoryId.toString(),
    userId: project.userId.toString(),
    columns: project.columns.map((col: LeanColumn) => ({
      id: col.id,
      name: col.name,
      order: col.order,
    })),
    viewType: project.viewType,
    archived: project.archived,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * Helper to serialize a category like categories.ts does
 */
function serializeCategory(category: LeanCategory) {
  return {
    _id: category._id.toString(),
    name: category.name,
    color: category.color,
    icon: category.icon,
    userId: category.userId.toString(),
    order: category.order,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/**
 * Helper to serialize a label like labels.ts does
 */
function serializeLabel(label: LeanLabel) {
  return {
    _id: label._id.toString(),
    name: label.name,
    color: label.color,
    userId: label.userId.toString(),
    createdAt: label.createdAt.toISOString(),
    updatedAt: label.updatedAt.toISOString(),
  };
}

/**
 * Helper to serialize a subtask like subtasks.ts does
 */
function serializeSubtask(subtask: LeanSubtask) {
  return {
    _id: subtask._id.toString(),
    title: subtask.title,
    completed: subtask.completed,
  };
}

describe("MCP Serializers", () => {
  let userId: mongoose.Types.ObjectId;
  let categoryId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
    const user = await createTestUser();
    userId = user._id;
    const category = await createTestCategory({ userId });
    categoryId = category._id;
    const project = await createTestProject({ userId, categoryId });
    projectId = project._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Task.deleteMany({});
    await Label.deleteMany({});
  });

  describe("serializeTask", () => {
    it("converts all ObjectIds to strings", async () => {
      const task = await createTestTask({ userId, projectId });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized._id).toBe(task._id.toString());
      expect(serialized.projectId).toBe(projectId.toString());
      expect(serialized.userId).toBe(userId.toString());
    });

    it("converts Dates to ISO strings", async () => {
      const dueDate = new Date("2026-03-01T00:00:00Z");
      const task = await createTestTask({ userId, projectId, dueDate });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.dueDate).toBe(dueDate.toISOString());
      expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(serialized.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("handles undefined optional fields", async () => {
      const task = await createTestTask({ userId, projectId });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.description).toBeUndefined();
      expect(serialized.assigneeId).toBeNull();
      expect(serialized.dueDate).toBeNull();
      expect(serialized.completedAt).toBeNull();
    });

    it("serializes assigneeId when present", async () => {
      const assignee = await createTestUser({
        email: "assignee@test.com",
        name: "Assignee",
      });
      const task = await Task.create({
        title: "Task with assignee",
        userId,
        projectId,
        columnId: "todo",
        order: 0,
        assigneeId: assignee._id,
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.assigneeId).toBe(assignee._id.toString());
    });

    it("serializes completedAt when present", async () => {
      const completedAt = new Date("2026-02-10T12:00:00Z");
      const task = await createTestTask({
        userId,
        projectId,
        completedAt,
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.completedAt).toBe(completedAt.toISOString());
    });

    it("serializes recurrence with endDate", async () => {
      const endDate = new Date("2026-12-31T23:59:59Z");
      const task = await Task.create({
        title: "Recurring Task",
        userId,
        projectId,
        columnId: "todo",
        order: 0,
        recurrence: {
          frequency: "weekly",
          interval: 2,
          endDate,
        },
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.recurrence.frequency).toBe("weekly");
      expect(serialized.recurrence.interval).toBe(2);
      expect(serialized.recurrence.endDate).toBe(endDate.toISOString());
    });

    it("serializes recurrence without endDate", async () => {
      const task = await createTestTask({ userId, projectId });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.recurrence.frequency).toBe("none");
      expect(serialized.recurrence.interval).toBe(1);
      expect(serialized.recurrence.endDate).toBeNull();
    });

    it("serializes labels array", async () => {
      const label1 = await createTestLabel({ userId, name: "Label 1" });
      const label2 = await createTestLabel({ userId, name: "Label 2" });
      const task = await Task.create({
        title: "Task with labels",
        userId,
        projectId,
        columnId: "todo",
        order: 0,
        labels: [label1._id, label2._id],
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.labels).toHaveLength(2);
      expect(serialized.labels[0]).toBe(label1._id.toString());
      expect(serialized.labels[1]).toBe(label2._id.toString());
    });

    it("serializes empty labels array", async () => {
      const task = await createTestTask({ userId, projectId });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.labels).toEqual([]);
    });

    it("serializes subtasks array", async () => {
      const task = await Task.create({
        title: "Task with subtasks",
        userId,
        projectId,
        columnId: "todo",
        order: 0,
        subtasks: [
          { title: "Subtask 1", completed: false },
          { title: "Subtask 2", completed: true },
        ],
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.subtasks).toHaveLength(2);
      expect(serialized.subtasks[0].title).toBe("Subtask 1");
      expect(serialized.subtasks[0].completed).toBe(false);
      expect(typeof serialized.subtasks[0]._id).toBe("string");
      expect(serialized.subtasks[1].title).toBe("Subtask 2");
      expect(serialized.subtasks[1].completed).toBe(true);
      expect(typeof serialized.subtasks[1]._id).toBe("string");
    });

    it("serializes statusHistory array", async () => {
      const timestamp1 = new Date("2026-02-01T10:00:00Z");
      const timestamp2 = new Date("2026-02-05T14:30:00Z");
      const task = await Task.create({
        title: "Task with status history",
        userId,
        projectId,
        columnId: "in-progress",
        order: 0,
        statusHistory: [
          { columnId: "todo", timestamp: timestamp1 },
          { columnId: "in-progress", timestamp: timestamp2 },
        ],
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.statusHistory).toHaveLength(2);
      expect(serialized.statusHistory[0].columnId).toBe("todo");
      expect(serialized.statusHistory[0].timestamp).toBe(
        timestamp1.toISOString(),
      );
      expect(serialized.statusHistory[1].columnId).toBe("in-progress");
      expect(serialized.statusHistory[1].timestamp).toBe(
        timestamp2.toISOString(),
      );
    });

    it("serializes reminderAt when present", async () => {
      const reminderAt = new Date("2026-02-28T09:00:00Z");
      const task = await Task.create({
        title: "Task with reminder",
        userId,
        projectId,
        columnId: "todo",
        order: 0,
        dueDate: new Date("2026-03-01T00:00:00Z"),
        reminderAt,
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.reminderAt).toBe(reminderAt.toISOString());
    });

    it("handles undefined reminderAt", async () => {
      const task = await createTestTask({ userId, projectId });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.reminderAt).toBeNull();
    });

    it("preserves priority enum value", async () => {
      const task = await Task.create({
        title: "Urgent task",
        userId,
        projectId,
        columnId: "todo",
        order: 0,
        priority: "urgent",
      });
      const lean = await Task.findById(task._id).lean<LeanTask>();
      if (!lean) throw new Error("Task not found");

      const serialized = serializeTask(lean);

      expect(serialized.priority).toBe("urgent");
    });
  });

  describe("serializeProject", () => {
    it("converts all ObjectIds to strings", async () => {
      const project = await Project.findById(projectId).lean<LeanProject>();
      if (!project) throw new Error("Project not found");

      const serialized = serializeProject(project);

      expect(serialized._id).toBe(projectId.toString());
      expect(serialized.categoryId).toBe(categoryId.toString());
      expect(serialized.userId).toBe(userId.toString());
    });

    it("converts Dates to ISO strings", async () => {
      const project = await Project.findById(projectId).lean<LeanProject>();
      if (!project) throw new Error("Project not found");

      const serialized = serializeProject(project);

      expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(serialized.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("serializes columns array", async () => {
      const project = await Project.findById(projectId).lean<LeanProject>();
      if (!project) throw new Error("Project not found");

      const serialized = serializeProject(project);

      expect(Array.isArray(serialized.columns)).toBe(true);
      expect(serialized.columns.length).toBeGreaterThan(0);
      serialized.columns.forEach((col: SerializedColumn) => {
        expect(col).toHaveProperty("id");
        expect(col).toHaveProperty("name");
        expect(col).toHaveProperty("order");
      });
    });

    it("handles undefined description", async () => {
      const project = await Project.findById(projectId).lean<LeanProject>();
      if (!project) throw new Error("Project not found");

      const serialized = serializeProject(project);

      expect(serialized.description).toBeUndefined();
    });

    it("preserves viewType and archived", async () => {
      const customProject = await createTestProject({
        userId,
        categoryId,
        name: "Custom Project",
        viewType: "list",
        archived: true,
      });
      const lean = await Project.findById(customProject._id).lean<LeanProject>();
      if (!lean) throw new Error("Project not found");

      const serialized = serializeProject(lean);

      expect(serialized.viewType).toBe("list");
      expect(serialized.archived).toBe(true);
    });
  });

  describe("serializeCategory", () => {
    it("converts all ObjectIds to strings", async () => {
      const category = await Category.findById(categoryId).lean<LeanCategory>();
      if (!category) throw new Error("Category not found");

      const serialized = serializeCategory(category);

      expect(serialized._id).toBe(categoryId.toString());
      expect(serialized.userId).toBe(userId.toString());
    });

    it("converts Dates to ISO strings", async () => {
      const category = await Category.findById(categoryId).lean<LeanCategory>();
      if (!category) throw new Error("Category not found");

      const serialized = serializeCategory(category);

      expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(serialized.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("preserves all category fields", async () => {
      const category = await Category.findById(categoryId).lean<LeanCategory>();
      if (!category) throw new Error("Category not found");

      const serialized = serializeCategory(category);

      expect(serialized.name).toBe(category.name);
      expect(serialized.color).toBe(category.color);
      expect(serialized.icon).toBe(category.icon);
      expect(serialized.order).toBe(category.order);
    });

    it("handles undefined icon field", async () => {
      const cat = await Category.create({
        name: "No Icon Category",
        color: "#ff0000",
        userId,
        order: 1,
      });
      const lean = await Category.findById(cat._id).lean<LeanCategory>();
      if (!lean) throw new Error("Category not found");

      const serialized = serializeCategory(lean);

      expect(serialized.icon).toBeUndefined();
    });
  });

  describe("serializeLabel", () => {
    it("converts all ObjectIds to strings", async () => {
      const label = await createTestLabel({ userId });
      const lean = await Label.findById(label._id).lean<LeanLabel>();
      if (!lean) throw new Error("Label not found");

      const serialized = serializeLabel(lean);

      expect(serialized._id).toBe(label._id.toString());
      expect(serialized.userId).toBe(userId.toString());
    });

    it("converts Dates to ISO strings", async () => {
      const label = await createTestLabel({ userId });
      const lean = await Label.findById(label._id).lean<LeanLabel>();
      if (!lean) throw new Error("Label not found");

      const serialized = serializeLabel(lean);

      expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(serialized.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("preserves all label fields", async () => {
      const label = await createTestLabel({
        userId,
        name: "Important",
        color: "#ff0000",
      });
      const lean = await Label.findById(label._id).lean<LeanLabel>();
      if (!lean) throw new Error("Label not found");

      const serialized = serializeLabel(lean);

      expect(serialized.name).toBe("Important");
      expect(serialized.color).toBe("#ff0000");
    });
  });

  describe("serializeSubtask", () => {
    it("converts ObjectId to string", () => {
      const subtask: LeanSubtask = {
        _id: new mongoose.Types.ObjectId(),
        title: "Test subtask",
        completed: false,
      };

      const serialized = serializeSubtask(subtask);

      expect(serialized._id).toBe(subtask._id.toString());
    });

    it("preserves title and completed status", () => {
      const subtask: LeanSubtask = {
        _id: new mongoose.Types.ObjectId(),
        title: "Completed subtask",
        completed: true,
      };

      const serialized = serializeSubtask(subtask);

      expect(serialized.title).toBe("Completed subtask");
      expect(serialized.completed).toBe(true);
    });

    it("handles incomplete subtask", () => {
      const subtask: LeanSubtask = {
        _id: new mongoose.Types.ObjectId(),
        title: "Incomplete subtask",
        completed: false,
      };

      const serialized = serializeSubtask(subtask);

      expect(serialized.title).toBe("Incomplete subtask");
      expect(serialized.completed).toBe(false);
    });
  });
});
