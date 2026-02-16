import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskList } from "./task-list";
import type { Task, Project } from "@/types";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    _id: "proj-1",
    name: "Test Project",
    userId: "user-1",
    columns: [
      { id: "todo", name: "To Do" },
      { id: "done", name: "Done" },
    ],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("TaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to project page when a task row is clicked", async () => {
    const user = userEvent.setup();
    const task = makeTask({ _id: "t1", projectId: "proj-42" });
    const project = makeProject({ _id: "proj-42", name: "My Project" });

    render(<TaskList tasks={[task]} projects={[project]} />);

    const row = screen.getByText("Test Task").closest("tr")!;
    await user.click(row);

    expect(mockPush).toHaveBeenCalledWith("/projects/proj-42");
  });

  it("navigates to the correct project for each task", async () => {
    const user = userEvent.setup();
    const task1 = makeTask({ _id: "t1", title: "Task A", projectId: "proj-1" });
    const task2 = makeTask({ _id: "t2", title: "Task B", projectId: "proj-2" });
    const proj1 = makeProject({ _id: "proj-1", name: "Project 1" });
    const proj2 = makeProject({ _id: "proj-2", name: "Project 2" });

    render(<TaskList tasks={[task1, task2]} projects={[proj1, proj2]} />);

    const rowB = screen.getByText("Task B").closest("tr")!;
    await user.click(rowB);

    expect(mockPush).toHaveBeenCalledWith("/projects/proj-2");
  });

  it("applies cursor-pointer class to task rows", () => {
    const task = makeTask();
    const project = makeProject();

    render(<TaskList tasks={[task]} projects={[project]} />);

    const row = screen.getByText("Test Task").closest("tr")!;
    expect(row.className).toContain("cursor-pointer");
  });

  it("does not render rows when tasks array is empty", () => {
    render(<TaskList tasks={[]} projects={[]} />);

    expect(screen.getByText("No tasks match your filters")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
