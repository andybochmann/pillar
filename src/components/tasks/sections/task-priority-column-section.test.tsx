import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskPriorityColumnSection } from "./task-priority-column-section";
import type { Priority, Column } from "@/types";

const mockColumns: Column[] = [
  { id: "col-1", name: "To Do", order: 0 },
  { id: "col-2", name: "In Progress", order: 1 },
  { id: "col-3", name: "Done", order: 2 },
];

describe("TaskPriorityColumnSection", () => {
  let onPriorityChange: ReturnType<typeof vi.fn>;
  let onColumnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPriorityChange = vi.fn();
    onColumnChange = vi.fn();
  });

  it("renders priority and column labels", () => {
    render(
      <TaskPriorityColumnSection
        priority="medium"
        columnId="col-1"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Column")).toBeInTheDocument();
  });

  it("renders priority select", () => {
    render(
      <TaskPriorityColumnSection
        priority="high"
        columnId="col-1"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    const prioritySelect = screen.getByLabelText("Priority");
    expect(prioritySelect).toBeInTheDocument();
  });

  it("renders column select", () => {
    render(
      <TaskPriorityColumnSection
        priority="medium"
        columnId="col-2"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    const columnSelect = screen.getByLabelText("Column");
    expect(columnSelect).toBeInTheDocument();
  });

  // Note: Radix UI Select uses portals which don't render properly in jsdom,
  // so we verify the component renders correctly with different values.
  // Visual verification and interaction testing is done via E2E tests.

  it("renders priority select with urgent priority", () => {
    render(
      <TaskPriorityColumnSection
        priority="urgent"
        columnId="col-1"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    const prioritySelect = screen.getByLabelText("Priority");
    expect(prioritySelect).toBeInTheDocument();
  });

  it("renders priority select with high priority", () => {
    render(
      <TaskPriorityColumnSection
        priority="high"
        columnId="col-1"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    const prioritySelect = screen.getByLabelText("Priority");
    expect(prioritySelect).toBeInTheDocument();
  });

  it("renders priority select with medium priority", () => {
    render(
      <TaskPriorityColumnSection
        priority="medium"
        columnId="col-1"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    const prioritySelect = screen.getByLabelText("Priority");
    expect(prioritySelect).toBeInTheDocument();
  });

  it("renders priority select with low priority", () => {
    render(
      <TaskPriorityColumnSection
        priority="low"
        columnId="col-1"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    const prioritySelect = screen.getByLabelText("Priority");
    expect(prioritySelect).toBeInTheDocument();
  });

  it("renders with different column values", () => {
    mockColumns.forEach((column) => {
      const { unmount } = render(
        <TaskPriorityColumnSection
          priority="medium"
          columnId={column.id}
          columns={mockColumns}
          onPriorityChange={onPriorityChange}
          onColumnChange={onColumnChange}
        />,
      );

      expect(screen.getByLabelText("Column")).toBeInTheDocument();
      unmount();
    });
  });

  it("renders with empty columns array", () => {
    render(
      <TaskPriorityColumnSection
        priority="medium"
        columnId="col-1"
        columns={[]}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    expect(screen.getByLabelText("Column")).toBeInTheDocument();
  });

  it("renders in a grid layout with two columns", () => {
    const { container } = render(
      <TaskPriorityColumnSection
        priority="medium"
        columnId="col-1"
        columns={mockColumns}
        onPriorityChange={onPriorityChange}
        onColumnChange={onColumnChange}
      />,
    );

    const gridElement = container.querySelector(".grid.grid-cols-2");
    expect(gridElement).toBeInTheDocument();
  });
});
