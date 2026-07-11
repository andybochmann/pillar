import { describe, it, expect } from "vitest";
import {
  getDueBucket,
  compareTasks,
  groupByProject,
  groupByDueBucket,
  DUE_BUCKET_ORDER,
} from "./my-work-grouping";
import type { Task, Project } from "@/types";

const NOW = new Date(2026, 6, 11); // 2026-07-11 local

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    _id: "task-1",
    title: "Test Task",
    projectId: "proj-1",
    userId: "user-1",
    columnId: "todo",
    priority: "medium",
    order: 0,
    labels: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    archived: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    _id: "proj-1",
    name: "Project One",
    categoryId: "cat-1",
    userId: "user-1",
    columns: [],
    viewType: "board",
    archived: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getDueBucket", () => {
  it("returns 'none' when there is no due date", () => {
    expect(getDueBucket(null, NOW)).toBe("none");
    expect(getDueBucket(undefined, NOW)).toBe("none");
  });

  it("returns 'overdue' for a past date", () => {
    expect(getDueBucket("2026-07-10T00:00:00Z", NOW)).toBe("overdue");
  });

  it("returns 'today' for the current calendar date", () => {
    expect(getDueBucket("2026-07-11T00:00:00Z", NOW)).toBe("today");
  });

  it("returns 'week' for a date within the next 7 days", () => {
    expect(getDueBucket("2026-07-14T00:00:00Z", NOW)).toBe("week");
    expect(getDueBucket("2026-07-18T00:00:00Z", NOW)).toBe("week");
  });

  it("returns 'later' for a date beyond 7 days", () => {
    expect(getDueBucket("2026-07-25T00:00:00Z", NOW)).toBe("later");
  });
});

describe("compareTasks", () => {
  it("sorts earlier due dates first", () => {
    const a = makeTask({ dueDate: "2026-07-15T00:00:00Z" });
    const b = makeTask({ dueDate: "2026-07-12T00:00:00Z" });
    expect(compareTasks(a, b)).toBeGreaterThan(0);
  });

  it("sorts undated tasks last", () => {
    const dated = makeTask({ dueDate: "2026-07-12T00:00:00Z" });
    const undated = makeTask({ dueDate: null });
    expect(compareTasks(dated, undated)).toBeLessThan(0);
  });

  it("breaks ties by priority", () => {
    const urgent = makeTask({ priority: "urgent", dueDate: null });
    const low = makeTask({ priority: "low", dueDate: null });
    expect(compareTasks(urgent, low)).toBeLessThan(0);
  });
});

describe("groupByProject", () => {
  it("groups tasks under their projects in project order and omits empty projects", () => {
    const p1 = makeProject({ _id: "p1", name: "Alpha" });
    const p2 = makeProject({ _id: "p2", name: "Beta" });
    const p3 = makeProject({ _id: "p3", name: "Gamma (empty)" });
    const tasks = [
      makeTask({ _id: "t1", projectId: "p2" }),
      makeTask({ _id: "t2", projectId: "p1" }),
    ];

    const groups = groupByProject(tasks, [p1, p2, p3]);

    expect(groups.map((g) => g.projectName)).toEqual(["Alpha", "Beta"]);
  });

  it("places tasks with unknown projects into an 'Other' group last", () => {
    const p1 = makeProject({ _id: "p1", name: "Alpha" });
    const tasks = [
      makeTask({ _id: "t1", projectId: "p1" }),
      makeTask({ _id: "t2", projectId: "ghost" }),
    ];

    const groups = groupByProject(tasks, [p1]);

    expect(groups.map((g) => g.projectName)).toEqual(["Alpha", "Other"]);
    expect(groups[1].tasks.map((t) => t._id)).toEqual(["t2"]);
  });

  it("resolves colors via the provided callback", () => {
    const p1 = makeProject({ _id: "p1", name: "Alpha" });
    const tasks = [makeTask({ _id: "t1", projectId: "p1" })];

    const groups = groupByProject(tasks, [p1], () => "#ff0000");

    expect(groups[0].color).toBe("#ff0000");
  });
});

describe("groupByDueBucket", () => {
  it("groups tasks into buckets in canonical order", () => {
    const tasks = [
      makeTask({ _id: "later", dueDate: "2026-07-25T00:00:00Z" }),
      makeTask({ _id: "overdue", dueDate: "2026-07-01T00:00:00Z" }),
      makeTask({ _id: "today", dueDate: "2026-07-11T00:00:00Z" }),
      makeTask({ _id: "none", dueDate: null }),
    ];

    const groups = groupByDueBucket(tasks, NOW);

    expect(groups.map((g) => g.bucket)).toEqual([
      "overdue",
      "today",
      "later",
      "none",
    ]);
    // Every produced bucket must be a valid, ordered bucket
    for (const g of groups) {
      expect(DUE_BUCKET_ORDER).toContain(g.bucket);
    }
  });
});
