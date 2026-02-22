import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListView } from "./list-view";
import type { Task, Column, ProjectMember } from "@/types";

// Mock useTasks hook
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();
let mockTasks: Task[] = [];

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: (initialTasks: Task[]) => {
    mockTasks = initialTasks;
    return {
      tasks: mockTasks,
      loading: false,
      error: null,
      setTasks: vi.fn(),
      fetchTasks: vi.fn(),
      createTask: mockCreateTask,
      updateTask: mockUpdateTask,
      deleteTask: mockDeleteTask,
    };
  },
}));

vi.mock("@/hooks/use-labels", () => ({
  useLabels: () => ({
    labels: [],
    createLabel: vi.fn(),
  }),
}));

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "done", name: "Done", order: 1 },
];

const activeTasks: Task[] = [
  {
    _id: "t1",
    title: "Buy milk",
    projectId: "p1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    order: 0,
    labels: [],
    subtasks: [],
    statusHistory: [],
    timeSessions: [],
    archived: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    _id: "t2",
    title: "Buy eggs",
    projectId: "p1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    order: 1,
    labels: [],
    subtasks: [],
    statusHistory: [],
    timeSessions: [],
    archived: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

const completedTasks: Task[] = [
  {
    _id: "t3",
    title: "Buy bread",
    projectId: "p1",
    userId: "u1",
    columnId: "done",
    priority: "medium",
    order: 0,
    labels: [],
    subtasks: [],
    statusHistory: [],
    timeSessions: [],
    completedAt: "2025-01-02T00:00:00.000Z",
    archived: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
  },
];

describe("ListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders quick-add input", () => {
    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={[]}
      />,
    );
    expect(screen.getByPlaceholderText("Add an item…")).toBeInTheDocument();
  });

  it("renders active tasks", () => {
    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={activeTasks}
      />,
    );
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("Buy eggs")).toBeInTheDocument();
  });

  it("renders completed section header with count", () => {
    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={[...activeTasks, ...completedTasks]}
      />,
    );
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("creates a task when pressing Enter in quick-add input", async () => {
    const user = userEvent.setup();
    mockCreateTask.mockResolvedValue({
      _id: "t-new",
      title: "New item",
      columnId: "todo",
    });

    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={[]}
      />,
    );

    const input = screen.getByPlaceholderText("Add an item…");
    await user.type(input, "New item{Enter}");

    expect(mockCreateTask).toHaveBeenCalledWith({
      title: "New item",
      projectId: "p1",
      columnId: "todo",
    });
  });

  it("does not create task with empty input", async () => {
    const user = userEvent.setup();

    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={[]}
      />,
    );

    const input = screen.getByPlaceholderText("Add an item…");
    await user.type(input, "{Enter}");

    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("completed section is collapsed by default", () => {
    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={[...activeTasks, ...completedTasks]}
      />,
    );
    // The completed task should not be visible since section is collapsed
    expect(screen.queryByText("Buy bread")).not.toBeInTheDocument();
  });

  it("expands completed section when clicked", async () => {
    const user = userEvent.setup();
    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={[...activeTasks, ...completedTasks]}
      />,
    );

    await user.click(screen.getByText(/Completed/));
    expect(screen.getByText("Buy bread")).toBeInTheDocument();
  });

  it("shows delete completed button when completed items exist", async () => {
    const user = userEvent.setup();
    render(
      <ListView
        projectId="p1"
        columns={columns}
        initialTasks={[...activeTasks, ...completedTasks]}
      />,
    );

    // Expand completed section first
    await user.click(screen.getByText(/Completed/));
    expect(screen.getByRole("button", { name: /delete completed/i })).toBeInTheDocument();
  });
});
