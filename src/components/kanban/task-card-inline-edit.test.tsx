import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "./task-card";
import type { Task, Column, Label } from "@/types";

// Mock @dnd-kit/sortable since jsdom doesn't support full DnD APIs
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-day-picker to avoid complex DOM rendering
vi.mock("react-day-picker", () => ({
  DayPicker: ({ onSelect, selected }: { onSelect?: (date: Date | undefined) => void; selected?: Date }) => (
    <div data-testid="mock-calendar">
      <button
        data-testid="calendar-day-15"
        onClick={() => onSelect?.(new Date("2026-03-15"))}
      >
        15
      </button>
      {selected && <span data-testid="selected-date">{selected.toISOString()}</span>}
    </div>
  ),
  getDefaultClassNames: () => ({}),
}));

const baseTask: Task = {
  _id: "task-1",
  title: "Fix login bug",
  projectId: "proj-1",
  userId: "user-1",
  columnId: "todo",
  priority: "high",
  order: 0,
  labels: [],
  subtasks: [],
  timeSessions: [],
  statusHistory: [],
  archived: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

const labels: Label[] = [
  { _id: "lbl-1", name: "bug", color: "#ef4444", userId: "user-1", createdAt: "", updatedAt: "" },
  { _id: "lbl-2", name: "feature", color: "#3b82f6", userId: "user-1", createdAt: "", updatedAt: "" },
];

describe("TaskCard Inline Title Editing", () => {
  const user = userEvent.setup();
  let onTitleSave: ReturnType<typeof vi.fn>;
  let onClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onTitleSave = vi.fn().mockResolvedValue(undefined);
    onClick = vi.fn();
  });

  it("shows edit icon on hover near the title", async () => {
    render(<TaskCard task={baseTask} onTitleSave={onTitleSave} />);
    // The edit icon should exist but be hidden by default (opacity-0)
    const editIcon = screen.getByTestId("inline-edit-icon");
    expect(editIcon).toBeInTheDocument();
  });

  it("switches to edit mode on double-click of the title", async () => {
    render(<TaskCard task={baseTask} onTitleSave={onTitleSave} />);
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    const input = screen.getByRole("textbox", { name: /edit task title/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Fix login bug");
  });

  it("does not show title text when editing", async () => {
    render(<TaskCard task={baseTask} onTitleSave={onTitleSave} />);
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    // The static title text should not be visible when editing
    expect(screen.queryByText("Fix login bug")).not.toBeInTheDocument();
  });

  it("saves on Enter key", async () => {
    render(<TaskCard task={baseTask} onTitleSave={onTitleSave} />);
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    const input = screen.getByRole("textbox", { name: /edit task title/i });
    await user.clear(input);
    await user.type(input, "Fix logout bug{Enter}");
    expect(onTitleSave).toHaveBeenCalledWith("task-1", "Fix logout bug");
  });

  it("saves on blur", async () => {
    render(
      <div>
        <TaskCard task={baseTask} onTitleSave={onTitleSave} />
        <button>other</button>
      </div>,
    );
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    const input = screen.getByRole("textbox", { name: /edit task title/i });
    await user.clear(input);
    await user.type(input, "Updated title");
    await user.click(screen.getByText("other"));
    expect(onTitleSave).toHaveBeenCalledWith("task-1", "Updated title");
  });

  it("cancels on Escape without saving", async () => {
    render(<TaskCard task={baseTask} onTitleSave={onTitleSave} />);
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    const input = screen.getByRole("textbox", { name: /edit task title/i });
    await user.clear(input);
    await user.type(input, "Changed title");
    await user.keyboard("{Escape}");
    expect(onTitleSave).not.toHaveBeenCalled();
    // Should restore the original title
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });

  it("does not save if title is empty", async () => {
    render(
      <div>
        <TaskCard task={baseTask} onTitleSave={onTitleSave} />
        <button>other</button>
      </div>,
    );
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    const input = screen.getByRole("textbox", { name: /edit task title/i });
    await user.clear(input);
    await user.click(screen.getByText("other"));
    expect(onTitleSave).not.toHaveBeenCalled();
  });

  it("does not save if title is unchanged", async () => {
    render(
      <div>
        <TaskCard task={baseTask} onTitleSave={onTitleSave} />
        <button>other</button>
      </div>,
    );
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    // Blur without changing anything
    await user.click(screen.getByText("other"));
    expect(onTitleSave).not.toHaveBeenCalled();
  });

  it("single click still triggers onClick (open sheet)", async () => {
    render(<TaskCard task={baseTask} onClick={onClick} onTitleSave={onTitleSave} />);
    const card = screen.getByText("Fix login bug").closest("[data-slot='card']") || screen.getByText("Fix login bug").parentElement!.parentElement!;
    await user.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it("does not enter edit mode without onTitleSave prop", async () => {
    render(<TaskCard task={baseTask} />);
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    // Should not switch to input mode
    expect(screen.queryByRole("textbox", { name: /edit task title/i })).not.toBeInTheDocument();
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });
});

describe("TaskCard Context Menu", () => {
  const user = userEvent.setup();
  let onContextAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onContextAction = vi.fn().mockResolvedValue(undefined);
  });

  it("shows context menu on right-click", async () => {
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={labels}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
  });

  it("shows priority submenu items", async () => {
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={labels}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    // Priority submenu trigger should be visible
    expect(screen.getByText("Priority")).toBeInTheDocument();
  });

  it("shows Move to submenu with column names", async () => {
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={labels}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    expect(screen.getByText("Move to")).toBeInTheDocument();
  });

  it("shows Delete with destructive styling", async () => {
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={labels}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    const deleteItem = screen.getByText("Delete");
    expect(deleteItem).toBeInTheDocument();
  });

  it("shows Complete option for non-done tasks", async () => {
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={labels}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("shows Reopen option for done tasks", async () => {
    const doneTask = { ...baseTask, columnId: "done", completedAt: "2026-01-01T00:00:00Z" };
    render(
      <TaskCard
        task={doneTask}
        columns={columns}
        allLabels={labels}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    expect(screen.getByText("Reopen")).toBeInTheDocument();
  });

  it("shows Archive option", async () => {
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={labels}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    expect(screen.getByText("Archive")).toBeInTheDocument();
  });

  it("does not show context menu without onContextAction", async () => {
    render(<TaskCard task={baseTask} />);
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    // Without onContextAction, no menu role should appear
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("TaskCard Due Date Popover", () => {
  const user = userEvent.setup();
  let onDueDateChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDueDateChange = vi.fn().mockResolvedValue(undefined);
  });

  it("opens date picker when clicking due date badge", async () => {
    const taskWithDate = {
      ...baseTask,
      dueDate: "2026-03-10T00:00:00Z",
    };
    render(<TaskCard task={taskWithDate} onDueDateChange={onDueDateChange} />);
    const dateBadge = screen.getByText("Mar 10");
    await user.click(dateBadge);
    await waitFor(() => {
      expect(screen.getByTestId("mock-calendar")).toBeInTheDocument();
    });
  });

  it("shows add-date button when no due date", async () => {
    render(<TaskCard task={baseTask} onDueDateChange={onDueDateChange} />);
    const addDateBtn = screen.getByTestId("add-due-date");
    expect(addDateBtn).toBeInTheDocument();
  });

  it("opens date picker when clicking add-date button", async () => {
    render(<TaskCard task={baseTask} onDueDateChange={onDueDateChange} />);
    const addDateBtn = screen.getByTestId("add-due-date");
    await user.click(addDateBtn);
    await waitFor(() => {
      expect(screen.getByTestId("mock-calendar")).toBeInTheDocument();
    });
  });

  it("calls onDueDateChange when selecting a date", async () => {
    render(<TaskCard task={baseTask} onDueDateChange={onDueDateChange} />);
    const addDateBtn = screen.getByTestId("add-due-date");
    await user.click(addDateBtn);
    const day15 = screen.getByTestId("calendar-day-15");
    await user.click(day15);
    expect(onDueDateChange).toHaveBeenCalledWith("task-1", expect.any(String));
  });

  it("shows clear button when due date exists", async () => {
    const taskWithDate = {
      ...baseTask,
      dueDate: "2026-03-10T00:00:00Z",
    };
    render(<TaskCard task={taskWithDate} onDueDateChange={onDueDateChange} />);
    const dateBadge = screen.getByText("Mar 10");
    await user.click(dateBadge);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    });
  });

  it("calls onDueDateChange with null when clear is clicked", async () => {
    const taskWithDate = {
      ...baseTask,
      dueDate: "2026-03-10T00:00:00Z",
    };
    render(<TaskCard task={taskWithDate} onDueDateChange={onDueDateChange} />);
    const dateBadge = screen.getByText("Mar 10");
    await user.click(dateBadge);
    const clearBtn = screen.getByRole("button", { name: /clear/i });
    await user.click(clearBtn);
    expect(onDueDateChange).toHaveBeenCalledWith("task-1", null);
  });

  it("does not show add-date button without onDueDateChange", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.queryByTestId("add-due-date")).not.toBeInTheDocument();
  });
});

describe("TaskCard code review fixes", () => {
  const user = userEvent.setup();

  it("inline title input has maxLength of 200", async () => {
    const onTitleSave = vi.fn().mockResolvedValue(undefined);
    render(<TaskCard task={baseTask} onTitleSave={onTitleSave} />);
    const title = screen.getByText("Fix login bug");
    await user.dblClick(title);
    const input = screen.getByRole("textbox", { name: /edit task title/i });
    expect(input).toHaveAttribute("maxLength", "200");
  });

  it("isDone uses last column by order, not column name", async () => {
    const onContextAction = vi.fn().mockResolvedValue(undefined);
    // Columns where last by order is "finished" (not named "done")
    const customColumns: Column[] = [
      { id: "backlog", name: "Backlog", order: 0 },
      { id: "wip", name: "WIP", order: 1 },
      { id: "finished", name: "Finished", order: 2 },
    ];
    // Task is in the last column
    const taskInLastCol = { ...baseTask, columnId: "finished" };
    render(
      <TaskCard
        task={taskInLastCol}
        columns={customColumns}
        allLabels={[]}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    // Should show Reopen (not Complete) since task is in the last column
    expect(screen.getByText("Reopen")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("Delete in context menu opens confirmation dialog", async () => {
    const onContextAction = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={[]}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    // Click Delete in context menu
    await user.click(screen.getByText("Delete"));
    // Should NOT immediately call onContextAction
    expect(onContextAction).not.toHaveBeenCalled();
    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText("Delete task?")).toBeInTheDocument();
    });
    expect(screen.getByText(/This will permanently delete/)).toBeInTheDocument();
  });

  it("confirming delete in dialog calls onContextAction", async () => {
    const onContextAction = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={[]}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(screen.getByText("Delete task?")).toBeInTheDocument();
    });
    // Confirm the deletion
    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(confirmBtn);
    expect(onContextAction).toHaveBeenCalledWith("task-1", { type: "delete" });
  });

  it("cancelling delete dialog does not call onContextAction", async () => {
    const onContextAction = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskCard
        task={baseTask}
        columns={columns}
        allLabels={[]}
        onContextAction={onContextAction}
      />,
    );
    const title = screen.getByText("Fix login bug");
    await user.pointer({ keys: "[MouseRight]", target: title });
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(screen.getByText("Delete task?")).toBeInTheDocument();
    });
    // Cancel the deletion
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onContextAction).not.toHaveBeenCalled();
  });
});
