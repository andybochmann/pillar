import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayDetail } from "./day-detail";
import type { Task, Project } from "@/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockProjects: Project[] = [
  {
    _id: "proj-1",
    name: "Frontend",
    categoryId: "cat-1",
    userId: "u1",
    columns: [{ id: "todo", name: "To Do", order: 0 }],
    archived: false,
    createdAt: "",
    updatedAt: "",
  },
];

const mockTasks: Task[] = [
  {
    _id: "task-1",
    title: "Fix CSS",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "high",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 0,
    labels: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-2",
    title: "Review PR",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    dueDate: "2026-02-15T00:00:00.000Z",
    recurrence: { frequency: "weekly", interval: 1 },
    order: 1,
    labels: [],
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DayDetail", () => {
  const defaultProps = {
    date: new Date(2026, 1, 15),
    tasks: mockTasks,
    projects: mockProjects,
    open: true,
    onOpenChange: vi.fn(),
    onTaskClick: vi.fn(),
    onCreateTask: vi.fn().mockResolvedValue(undefined),
  };

  it("renders date heading", () => {
    render(<DayDetail {...defaultProps} />);
    expect(screen.getByText("Sunday, February 15, 2026")).toBeInTheDocument();
  });

  it("renders tasks grouped by project", () => {
    render(<DayDetail {...defaultProps} />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Fix CSS")).toBeInTheDocument();
    expect(screen.getByText("Review PR")).toBeInTheDocument();
  });

  it("renders priority badges", () => {
    render(<DayDetail {...defaultProps} />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders recurrence indicator", () => {
    render(<DayDetail {...defaultProps} />);
    expect(screen.getByTitle("Recurring task")).toBeInTheDocument();
  });

  it("calls onTaskClick when task is clicked", async () => {
    const user = userEvent.setup();
    const onTaskClick = vi.fn();
    render(<DayDetail {...defaultProps} onTaskClick={onTaskClick} />);

    await user.click(screen.getByText("Fix CSS"));
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it("renders empty state when no tasks", () => {
    render(<DayDetail {...defaultProps} tasks={[]} />);
    expect(screen.getByText("No tasks on this date")).toBeInTheDocument();
  });

  it("renders quick create input", () => {
    render(<DayDetail {...defaultProps} />);
    expect(screen.getByLabelText("New task title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("calls onCreateTask when form submitted", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn().mockResolvedValue(undefined);
    render(<DayDetail {...defaultProps} onCreateTask={onCreateTask} />);

    await user.type(screen.getByLabelText("New task title"), "New task");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreateTask).toHaveBeenCalledWith(
      "New task",
      expect.stringContaining("2026-02-15"),
    );
  });

  it("does not render when date is null", () => {
    render(<DayDetail {...defaultProps} date={null} />);
    expect(screen.queryByText("Frontend")).not.toBeInTheDocument();
  });
});
