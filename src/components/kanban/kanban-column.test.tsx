import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanColumn } from "./kanban-column";
import type { Task, Column } from "@/types";

// jsdom doesn't support full DnD APIs
vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

// Keep child components trivial so we only exercise the column header
vi.mock("./task-card", () => ({
  TaskCard: ({ task }: { task: Task }) => <div>{task.title}</div>,
}));

vi.mock("@/components/tasks/task-form", () => ({
  TaskForm: () => null,
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    _id: `task-${Math.random()}`,
    title: "A task",
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

const baseColumn: Column = { id: "todo", name: "To Do", order: 0 };

function renderColumn(column: Column, tasks: Task[], wipCount?: number) {
  return render(
    <KanbanColumn
      column={column}
      columns={[column]}
      tasks={tasks}
      wipCount={wipCount}
      onAddTask={vi.fn()}
      onTaskClick={vi.fn()}
    />,
  );
}

describe("KanbanColumn — WIP limits", () => {
  it("shows only the count when no wipLimit is set", () => {
    renderColumn(baseColumn, [makeTask(), makeTask()]);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it("shows count / limit when wipLimit is set and within limit", () => {
    renderColumn({ ...baseColumn, wipLimit: 3 }, [makeTask(), makeTask()]);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("does not flag the region when count equals the limit", () => {
    renderColumn({ ...baseColumn, wipLimit: 2 }, [makeTask(), makeTask()]);
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute(
      "aria-label",
      "To Do column, 2 of 2 tasks",
    );
    expect(region.className).not.toContain("ring-destructive");
  });

  it("flags the column with a warning when count exceeds the limit", () => {
    renderColumn({ ...baseColumn, wipLimit: 1 }, [makeTask(), makeTask()]);
    expect(screen.getByText("2 / 1")).toBeInTheDocument();
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute(
      "aria-label",
      "To Do column, 2 of 1 tasks, over WIP limit",
    );
    expect(region.className).toContain("ring-destructive");
  });

  it("uses wipCount (true column size) not the rendered/filtered task count", () => {
    // Board filters hide all but one task, but the column truly holds 4 (> limit).
    renderColumn({ ...baseColumn, wipLimit: 2 }, [makeTask()], 4);
    expect(screen.getByText("4 / 2")).toBeInTheDocument();
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute(
      "aria-label",
      "To Do column, 4 of 2 tasks, over WIP limit",
    );
    expect(region.className).toContain("ring-destructive");
  });
});
