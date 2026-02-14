import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskSheet } from "./task-sheet";
import type { Task, Column } from "@/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockColumns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

const mockTask: Task = {
  _id: "task-1",
  title: "Fix login bug",
  description: "Users can't log in on mobile",
  projectId: "proj-1",
  userId: "u1",
  columnId: "todo",
  priority: "high",
  dueDate: "2026-03-15T00:00:00.000Z",
  order: 0,
  labels: ["bug", "urgent"],
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("TaskSheet", () => {
  const defaultProps = {
    task: mockTask,
    columns: mockColumns,
    open: true,
    onOpenChange: vi.fn(),
    onUpdate: vi.fn().mockResolvedValue({}),
    onDelete: vi.fn().mockResolvedValue(undefined),
  };

  it("renders task fields", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(screen.getByLabelText("Title")).toHaveValue("Fix login bug");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Users can't log in on mobile",
    );
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("renders priority and column selects", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Column")).toBeInTheDocument();
  });

  it("renders due date", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(screen.getByLabelText("Due Date")).toHaveValue("2026-03-15");
  });

  it("renders Mark Complete button", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Mark Complete" }),
    ).toBeInTheDocument();
  });

  it("renders Reopen button for completed tasks", () => {
    const completedTask = { ...mockTask, completedAt: "2026-03-01T00:00:00Z" };
    render(<TaskSheet {...defaultProps} task={completedTask} />);
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  it("renders Delete button", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows delete confirmation when Delete is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TaskSheet {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete task?")).toBeInTheDocument();
    expect(screen.getByText(/will be permanently deleted/)).toBeInTheDocument();
  });

  it("calls onDelete when confirmed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<TaskSheet {...defaultProps} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledWith("task-1");
  });

  it("saves title on blur", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdate = vi.fn().mockResolvedValue({});
    render(<TaskSheet {...defaultProps} onUpdate={onUpdate} />);

    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated title");
    await user.tab(); // blur

    // Advance past debounce
    vi.advanceTimersByTime(600);

    expect(onUpdate).toHaveBeenCalledWith("task-1", { title: "Updated title" });
  });

  it("does not render when task is null", () => {
    render(<TaskSheet {...defaultProps} task={null} />);
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<TaskSheet {...defaultProps} open={false} />);
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("renders labels input", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(screen.getByLabelText("Labels")).toBeInTheDocument();
  });
});
