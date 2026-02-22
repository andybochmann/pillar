import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchivedTasksSheet } from "./archived-tasks-sheet";
import type { Task } from "@/types";

const mockTasks: Task[] = [
  {
    _id: "task-1",
    title: "Old archived task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    order: 0,
    labels: [],
    subtasks: [],
    statusHistory: [],
    timeSessions: [],
    archived: true,
    archivedAt: "2025-12-01T00:00:00.000Z",
    createdAt: "2025-11-01T00:00:00.000Z",
    updatedAt: "2025-12-01T00:00:00.000Z",
  },
  {
    _id: "task-2",
    title: "Recent archived task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "done",
    priority: "high",
    order: 1,
    labels: [],
    subtasks: [],
    statusHistory: [],
    timeSessions: [],
    archived: true,
    archivedAt: "2026-02-15T00:00:00.000Z",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z",
  },
];

const mockFetchArchived = vi.fn();
const mockUnarchiveTask = vi.fn();
const mockPermanentDeleteTask = vi.fn();
const mockBulkDeleteArchived = vi.fn();

vi.mock("@/hooks/use-archived-tasks", () => ({
  useArchivedTasks: () => ({
    archivedTasks: mockTasks,
    loading: false,
    error: null,
    fetchArchived: mockFetchArchived,
    unarchiveTask: mockUnarchiveTask,
    permanentDeleteTask: mockPermanentDeleteTask,
    bulkDeleteArchived: mockBulkDeleteArchived,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock use-back-button (used by ConfirmDialog)
vi.mock("@/hooks/use-back-button", () => ({
  useBackButton: vi.fn(),
}));

describe("ArchivedTasksSheet", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkDeleteArchived.mockResolvedValue(2);
  });

  function renderSheet() {
    return render(
      <ArchivedTasksSheet
        projectId="proj-1"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
  }

  it("renders task cards with checkboxes", () => {
    renderSheet();
    const checkboxes = screen.getAllByRole("checkbox");
    // 1 select-all + 2 per-task = 3
    expect(checkboxes.length).toBe(3);
    expect(screen.getByText("Old archived task")).toBeInTheDocument();
    expect(screen.getByText("Recent archived task")).toBeInTheDocument();
  });

  it("selects and deselects individual tasks via checkbox", async () => {
    renderSheet();
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is select-all, second is task-1, third is task-2
    const task1Checkbox = checkboxes[1];

    await user.click(task1Checkbox);
    expect(task1Checkbox).toBeChecked();

    await user.click(task1Checkbox);
    expect(task1Checkbox).not.toBeChecked();
  });

  it("select all checkbox selects and deselects all tasks", async () => {
    renderSheet();
    const checkboxes = screen.getAllByRole("checkbox");
    const selectAll = checkboxes[0];

    await user.click(selectAll);
    // All task checkboxes should be checked
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).toBeChecked();

    await user.click(selectAll);
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
  });

  it("shows selection count in toolbar when tasks selected", async () => {
    renderSheet();
    const checkboxes = screen.getAllByRole("checkbox");

    await user.click(checkboxes[1]); // select task-1
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(checkboxes[2]); // select task-2
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("delete selected action calls bulkDeleteArchived with taskIds", async () => {
    mockBulkDeleteArchived.mockResolvedValue(1);
    renderSheet();

    // Select task-2 via its labeled checkbox (sorted: task-2 first since newer)
    const task2Checkbox = screen.getByRole("checkbox", {
      name: /select recent archived task/i,
    });
    await user.click(task2Checkbox);

    // Open the bulk actions dropdown
    const actionsButton = screen.getByRole("button", { name: /bulk actions/i });
    await user.click(actionsButton);

    // Click "Delete Selected"
    const deleteSelected = screen.getByRole("menuitem", {
      name: /delete selected/i,
    });
    await user.click(deleteSelected);

    // Confirm dialog should appear
    expect(
      screen.getByText(/permanently delete 1 archived task/i),
    ).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    await user.click(confirmButton);

    expect(mockBulkDeleteArchived).toHaveBeenCalledWith({
      projectId: "proj-1",
      taskIds: ["task-2"],
    });
  });

  it("delete all action calls bulkDeleteArchived without taskIds", async () => {
    renderSheet();

    const actionsButton = screen.getByRole("button", { name: /bulk actions/i });
    await user.click(actionsButton);

    const deleteAll = screen.getByRole("menuitem", { name: /delete all/i });
    await user.click(deleteAll);

    // Confirm dialog
    expect(
      screen.getByText(/permanently delete all 2 archived tasks/i),
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    await user.click(confirmButton);

    expect(mockBulkDeleteArchived).toHaveBeenCalledWith({
      projectId: "proj-1",
    });
  });

  it("delete older than 30 days calls bulkDeleteArchived with olderThanDays", async () => {
    renderSheet();

    const actionsButton = screen.getByRole("button", { name: /bulk actions/i });
    await user.click(actionsButton);

    // Hover over sub-trigger to open sub-menu
    const olderThan = screen.getByText(/delete older than/i);
    fireEvent.pointerMove(olderThan);
    fireEvent.pointerEnter(olderThan);
    fireEvent.click(olderThan);

    // Wait for sub-menu to appear then click "30 days"
    const days30 = await screen.findByRole("menuitem", { name: /^30 days$/i });
    fireEvent.click(days30);

    // Confirm dialog
    expect(
      screen.getByText(/older than 30 days/i),
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    await user.click(confirmButton);

    expect(mockBulkDeleteArchived).toHaveBeenCalledWith({
      projectId: "proj-1",
      olderThanDays: 30,
    });
  });

  it("resets selection after successful delete", async () => {
    mockBulkDeleteArchived.mockResolvedValue(1);
    renderSheet();

    // Select a task
    const task2Checkbox = screen.getByRole("checkbox", {
      name: /select recent archived task/i,
    });
    await user.click(task2Checkbox);
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    // Delete selected via dropdown
    const actionsButton = screen.getByRole("button", { name: /bulk actions/i });
    await user.click(actionsButton);
    const deleteSelected = screen.getByRole("menuitem", {
      name: /delete selected/i,
    });
    await user.click(deleteSelected);

    const confirmButton = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    await user.click(confirmButton);

    // Selection should be cleared — "1 selected" should not show
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it("disables delete selected when no tasks are selected", async () => {
    renderSheet();

    const actionsButton = screen.getByRole("button", { name: /bulk actions/i });
    await user.click(actionsButton);

    const deleteSelected = screen.getByRole("menuitem", {
      name: /delete selected/i,
    });
    // Radix DropdownMenu uses data-disabled attribute
    expect(deleteSelected).toHaveAttribute("data-disabled");
  });
});
