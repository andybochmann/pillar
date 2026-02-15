import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { ListItem } from "./list-item";
import type { Task } from "@/types";

const baseTask: Task = {
  _id: "task-1",
  title: "Buy groceries",
  projectId: "proj-1",
  userId: "user-1",
  columnId: "todo",
  priority: "medium",
  order: 0,
  labels: [],
  subtasks: [],
  statusHistory: [],
  timeSessions: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("ListItem", () => {
  it("renders task title", () => {
    render(
      <ListItem
        task={baseTask}
        completed={false}
        onToggle={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Buy groceries")).toBeInTheDocument();
  });

  it("renders checkbox unchecked for active items", () => {
    render(
      <ListItem
        task={baseTask}
        completed={false}
        onToggle={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("renders checkbox checked for completed items", () => {
    render(
      <ListItem
        task={{ ...baseTask, columnId: "done", completedAt: "2025-01-02T00:00:00.000Z" }}
        completed={true}
        onToggle={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("applies strikethrough on completed items", () => {
    render(
      <ListItem
        task={{ ...baseTask, completedAt: "2025-01-02T00:00:00.000Z" }}
        completed={true}
        onToggle={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const title = screen.getByText("Buy groceries");
    expect(title.className).toContain("line-through");
  });

  it("calls onToggle when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ListItem
        task={baseTask}
        completed={false}
        onToggle={onToggle}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("task-1");
  });

  it("calls onClick when title is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ListItem
        task={baseTask}
        completed={false}
        onToggle={vi.fn()}
        onClick={onClick}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Buy groceries"));
    expect(onClick).toHaveBeenCalledWith("task-1");
  });

  it("shows delete button for completed items", () => {
    render(
      <ListItem
        task={{ ...baseTask, completedAt: "2025-01-02T00:00:00.000Z" }}
        completed={true}
        onToggle={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <ListItem
        task={{ ...baseTask, completedAt: "2025-01-02T00:00:00.000Z" }}
        completed={true}
        onToggle={vi.fn()}
        onClick={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("task-1");
  });

  it("shows due date badge when dueDate is set", () => {
    const dueDate = "2025-06-15T12:00:00.000Z";
    render(
      <ListItem
        task={{ ...baseTask, dueDate }}
        completed={false}
        onToggle={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // Verify a date is rendered (exact text depends on timezone)
    const expected = format(new Date(dueDate), "MMM d");
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
