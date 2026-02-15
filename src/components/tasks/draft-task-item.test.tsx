import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftTaskItem } from "./draft-task-item";
import type { TaskDraft, Column } from "@/types";

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

function makeDraft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    id: "draft-1",
    title: "Test Task",
    description: "A test description",
    priority: "medium",
    columnId: "todo",
    subtasks: [],
    selected: true,
    ...overrides,
  };
}

describe("DraftTaskItem", () => {
  it("renders task title in input", () => {
    render(
      <DraftTaskItem
        draft={makeDraft()}
        columns={columns}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Task title");
    expect(input).toHaveValue("Test Task");
  });

  it("renders description when present", () => {
    render(
      <DraftTaskItem
        draft={makeDraft({ description: "My description" })}
        columns={columns}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("My description")).toBeInTheDocument();
  });

  it("does not render description when absent", () => {
    render(
      <DraftTaskItem
        draft={makeDraft({ description: undefined })}
        columns={columns}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.queryByText("My description")).not.toBeInTheDocument();
  });

  it("renders subtask count", () => {
    render(
      <DraftTaskItem
        draft={makeDraft({ subtasks: ["Sub 1", "Sub 2"] })}
        columns={columns}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("2 subtasks")).toBeInTheDocument();
  });

  it("renders singular subtask text", () => {
    render(
      <DraftTaskItem
        draft={makeDraft({ subtasks: ["Sub 1"] })}
        columns={columns}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("1 subtask")).toBeInTheDocument();
  });

  it("renders column name in badge", () => {
    render(
      <DraftTaskItem
        draft={makeDraft({ columnId: "in-progress" })}
        columns={columns}
        onToggle={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("calls onToggle when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <DraftTaskItem
        draft={makeDraft()}
        columns={columns}
        onToggle={onToggle}
        onUpdate={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Select Test Task"));
    expect(onToggle).toHaveBeenCalledWith("draft-1");
  });

  it("calls onUpdate when title changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <DraftTaskItem
        draft={makeDraft()}
        columns={columns}
        onToggle={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    const input = screen.getByLabelText("Task title");
    await user.clear(input);
    await user.type(input, "New Title");

    expect(onUpdate).toHaveBeenCalled();
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
    expect(lastCall[0]).toBe("draft-1");
    expect(lastCall[1]).toHaveProperty("title");
  });
});
