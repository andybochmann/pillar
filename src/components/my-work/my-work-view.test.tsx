import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyWorkView } from "./my-work-view";
import type { Task, Project, Category } from "@/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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

const categories: Category[] = [
  {
    _id: "cat-1",
    name: "Work",
    color: "#123456",
    userId: "user-1",
    order: 0,
    collapsed: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

function mockFetchOnce(tasks: Task[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tasks,
    }),
  );
}

function renderView(tasks: Task[], projects: Project[]) {
  mockFetchOnce(tasks);
  return render(
    <MyWorkView userId="user-1" projects={projects} categories={categories} />,
  );
}

describe("MyWorkView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("requests open tasks assigned to the current user", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <MyWorkView userId="me-123" projects={[]} categories={categories} />,
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).toContain("assigneeId=me-123");
    expect(fetchSpy.mock.calls[0][0]).toContain("completed=false");
  });

  it("groups tasks by project with a project header", async () => {
    const p1 = makeProject({ _id: "p1", name: "Alpha" });
    const p2 = makeProject({ _id: "p2", name: "Beta" });
    renderView(
      [
        makeTask({ _id: "t1", title: "Alpha task", projectId: "p1" }),
        makeTask({ _id: "t2", title: "Beta task", projectId: "p2" }),
      ],
      [p1, p2],
    );

    // Section landmarks named after each project
    expect(await screen.findByRole("region", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByText("Alpha task")).toBeInTheDocument();
    expect(screen.getByText("Beta task")).toBeInTheDocument();
  });

  it("labels overdue tasks with text, not color alone", async () => {
    renderView(
      [makeTask({ _id: "t1", title: "Late task", dueDate: "2026-07-01T00:00:00Z" })],
      [makeProject({ _id: "proj-1", name: "Project One" })],
    );

    const overdue = await screen.findByText(/Overdue/);
    expect(overdue).toBeInTheDocument();
    expect(overdue.className).toContain("text-red-600");
  });

  it("renders task rows as keyboard-focusable buttons that open the task", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView(
      [makeTask({ _id: "t1", title: "Openable", projectId: "p9" })],
      [makeProject({ _id: "p9", name: "Nine" })],
    );

    const row = await screen.findByRole("button", { name: "Open task Openable" });
    row.focus();
    expect(row).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/projects/p9?taskId=t1");
  });

  it("shows an empty state when no tasks are assigned", async () => {
    renderView([], []);
    expect(
      await screen.findByText("No tasks assigned to you"),
    ).toBeInTheDocument();
  });

  it("can switch to grouping by due date", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView(
      [makeTask({ _id: "t1", title: "Late task", dueDate: "2026-07-01T00:00:00Z" })],
      [makeProject({ _id: "proj-1", name: "Project One" })],
    );

    await screen.findByText("Late task");
    await user.click(screen.getByRole("button", { name: "By due date" }));

    expect(screen.getByRole("region", { name: "Overdue" })).toBeInTheDocument();
  });
});
