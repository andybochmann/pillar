import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskSheet } from "./task-sheet";
import type { Task, Column, Label as LabelType } from "@/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockColumns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

const mockLabels: LabelType[] = [
  {
    _id: "lbl-1",
    name: "bug",
    color: "#ef4444",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "lbl-2",
    name: "urgent",
    color: "#f97316",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
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
  labels: ["lbl-1", "lbl-2"],
  subtasks: [],
  statusHistory: [],
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
    allLabels: mockLabels,
  };

  it("renders task fields", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(screen.getByLabelText("Title")).toHaveValue("Fix login bug");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Users can't log in on mobile",
    );
    expect(screen.getByText("bug ×")).toBeInTheDocument();
    expect(screen.getByText("urgent ×")).toBeInTheDocument();
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

  it("renders labels section", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Manage labels" }),
    ).toBeInTheDocument();
  });

  it("renders subtasks section", () => {
    render(<TaskSheet {...defaultProps} />);
    expect(screen.getByLabelText("New subtask title")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add subtask" }),
    ).toBeInTheDocument();
  });

  it("renders existing subtasks", () => {
    const taskWithSubs: Task = {
      ...mockTask,
      subtasks: [
        { _id: "s1", title: "Write tests", completed: false },
        { _id: "s2", title: "Fix bug", completed: true },
      ],
    };
    render(<TaskSheet {...defaultProps} task={taskWithSubs} />);
    expect(screen.getByText("Write tests")).toBeInTheDocument();
    expect(screen.getByText("Fix bug")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 completed")).toBeInTheDocument();
  });

  it("adds a subtask", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdate = vi.fn().mockResolvedValue({});
    render(<TaskSheet {...defaultProps} onUpdate={onUpdate} />);

    const input = screen.getByLabelText("New subtask title");
    await user.type(input, "New subtask");
    await user.click(screen.getByRole("button", { name: "Add subtask" }));

    expect(screen.getByText("New subtask")).toBeInTheDocument();

    vi.advanceTimersByTime(600);
    expect(onUpdate).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        subtasks: expect.arrayContaining([
          expect.objectContaining({ title: "New subtask", completed: false }),
        ]),
      }),
    );
  });

  it("toggles a subtask", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdate = vi.fn().mockResolvedValue({});
    const taskWithSub: Task = {
      ...mockTask,
      subtasks: [{ _id: "s1", title: "Do thing", completed: false }],
    };
    render(<TaskSheet {...defaultProps} task={taskWithSub} onUpdate={onUpdate} />);

    await user.click(screen.getByRole("checkbox", { name: "Toggle Do thing" }));

    vi.advanceTimersByTime(600);
    expect(onUpdate).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        subtasks: [expect.objectContaining({ _id: "s1", completed: true })],
      }),
    );
  });

  it("deletes a subtask", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUpdate = vi.fn().mockResolvedValue({});
    const taskWithSub: Task = {
      ...mockTask,
      subtasks: [{ _id: "s1", title: "Remove me", completed: false }],
    };
    render(<TaskSheet {...defaultProps} task={taskWithSub} onUpdate={onUpdate} />);

    await user.click(
      screen.getByRole("button", { name: "Delete Remove me" }),
    );

    expect(screen.queryByText("Remove me")).not.toBeInTheDocument();

    vi.advanceTimersByTime(600);
    expect(onUpdate).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ subtasks: [] }),
    );
  });

  it("adds a subtask on Enter key", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TaskSheet {...defaultProps} />);

    const input = screen.getByLabelText("New subtask title");
    await user.type(input, "Enter task{Enter}");

    expect(screen.getByText("Enter task")).toBeInTheDocument();
  });
});
