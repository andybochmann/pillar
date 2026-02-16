import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskSubtasksSection } from "./task-subtasks-section";
import type { Subtask } from "@/types";

const mockSubtasks: Subtask[] = [
  { _id: "st-1", title: "First subtask", completed: false },
  { _id: "st-2", title: "Second subtask", completed: true },
  { _id: "st-3", title: "Third subtask", completed: false },
];

describe("TaskSubtasksSection", () => {
  let onToggleSubtask: ReturnType<typeof vi.fn>;
  let onDeleteSubtask: ReturnType<typeof vi.fn>;
  let onNewSubtaskTitleChange: ReturnType<typeof vi.fn>;
  let onAddSubtask: ReturnType<typeof vi.fn>;
  let onSubtaskKeyDown: ReturnType<typeof vi.fn>;
  let onGenerateClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggleSubtask = vi.fn();
    onDeleteSubtask = vi.fn();
    onNewSubtaskTitleChange = vi.fn();
    onAddSubtask = vi.fn();
    onSubtaskKeyDown = vi.fn();
    onGenerateClick = vi.fn();
  });

  it("renders Subtasks label", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByText("Subtasks")).toBeInTheDocument();
  });

  it("renders input field with placeholder", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(
      screen.getByPlaceholderText("Add a subtask…"),
    ).toBeInTheDocument();
  });

  it("does not show completion counter when no subtasks", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.queryByText(/completed/)).not.toBeInTheDocument();
  });

  it("shows completion counter with subtasks", () => {
    render(
      <TaskSubtasksSection
        subtasks={mockSubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByText("1 of 3 completed")).toBeInTheDocument();
  });

  it("renders all subtasks", () => {
    render(
      <TaskSubtasksSection
        subtasks={mockSubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByText("First subtask")).toBeInTheDocument();
    expect(screen.getByText("Second subtask")).toBeInTheDocument();
    expect(screen.getByText("Third subtask")).toBeInTheDocument();
  });

  it("calls onToggleSubtask when checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskSubtasksSection
        subtasks={mockSubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    await user.click(screen.getByLabelText("Toggle First subtask"));
    expect(onToggleSubtask).toHaveBeenCalledWith("st-1");
  });

  it("calls onDeleteSubtask when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskSubtasksSection
        subtasks={mockSubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    await user.click(screen.getByLabelText("Delete First subtask"));
    expect(onDeleteSubtask).toHaveBeenCalledWith("st-1");
  });

  it("calls onNewSubtaskTitleChange when typing in input", async () => {
    const user = userEvent.setup();
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    await user.type(screen.getByLabelText("New subtask title"), "Test");
    expect(onNewSubtaskTitleChange).toHaveBeenCalled();
  });

  it("calls onAddSubtask when add button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle="New task"
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    await user.click(screen.getByLabelText("Add subtask"));
    expect(onAddSubtask).toHaveBeenCalled();
  });

  it("disables add button when input is empty", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByLabelText("Add subtask")).toBeDisabled();
  });

  it("disables add button when input is whitespace only", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle="   "
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByLabelText("Add subtask")).toBeDisabled();
  });

  it("enables add button when input has text", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle="New subtask"
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByLabelText("Add subtask")).not.toBeDisabled();
  });

  it("calls onSubtaskKeyDown on key press in input", async () => {
    const user = userEvent.setup();
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    const input = screen.getByLabelText("New subtask title");
    await user.type(input, "{Enter}");
    expect(onSubtaskKeyDown).toHaveBeenCalled();
  });

  it("does not show AI generate button when aiEnabled is false", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
        aiEnabled={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /generate subtasks/i }),
    ).not.toBeInTheDocument();
  });

  it("shows AI generate button when aiEnabled is true", () => {
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
        aiEnabled={true}
        onGenerateClick={onGenerateClick}
      />,
    );

    expect(
      screen.getByRole("button", { name: /generate subtasks/i }),
    ).toBeInTheDocument();
  });

  it("calls onGenerateClick when AI generate button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
        aiEnabled={true}
        onGenerateClick={onGenerateClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: /generate subtasks/i }));
    expect(onGenerateClick).toHaveBeenCalled();
  });

  it("disables AI generate button when at maxSubtasks limit", () => {
    const manySubtasks: Subtask[] = Array.from({ length: 50 }, (_, i) => ({
      _id: `st-${i}`,
      title: `Subtask ${i}`,
      completed: false,
    }));

    render(
      <TaskSubtasksSection
        subtasks={manySubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
        aiEnabled={true}
        onGenerateClick={onGenerateClick}
        maxSubtasks={50}
      />,
    );

    expect(
      screen.getByRole("button", { name: /generate subtasks/i }),
    ).toBeDisabled();
  });

  it("shows correct completion counter when all completed", () => {
    const allCompleted: Subtask[] = [
      { _id: "st-1", title: "Task 1", completed: true },
      { _id: "st-2", title: "Task 2", completed: true },
    ];

    render(
      <TaskSubtasksSection
        subtasks={allCompleted}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByText("2 of 2 completed")).toBeInTheDocument();
  });

  it("shows correct completion counter when none completed", () => {
    const noneCompleted: Subtask[] = [
      { _id: "st-1", title: "Task 1", completed: false },
      { _id: "st-2", title: "Task 2", completed: false },
    ];

    render(
      <TaskSubtasksSection
        subtasks={noneCompleted}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    expect(screen.getByText("0 of 2 completed")).toBeInTheDocument();
  });

  it("renders with space-y-2 layout class", () => {
    const { container } = render(
      <TaskSubtasksSection
        subtasks={[]}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    const section = container.querySelector(".space-y-2");
    expect(section).toBeInTheDocument();
  });

  it("applies line-through style to completed subtasks", () => {
    render(
      <TaskSubtasksSection
        subtasks={mockSubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    const completedSubtask = screen.getByText("Second subtask");
    expect(completedSubtask).toHaveClass("line-through");
  });

  it("does not apply line-through to uncompleted subtasks", () => {
    render(
      <TaskSubtasksSection
        subtasks={mockSubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
      />,
    );

    const uncompletedSubtask = screen.getByText("First subtask");
    expect(uncompletedSubtask).not.toHaveClass("line-through");
  });

  it("renders with custom maxSubtasks value", () => {
    const manySubtasks: Subtask[] = Array.from({ length: 25 }, (_, i) => ({
      _id: `st-${i}`,
      title: `Subtask ${i}`,
      completed: false,
    }));

    render(
      <TaskSubtasksSection
        subtasks={manySubtasks}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        newSubtaskTitle=""
        onNewSubtaskTitleChange={onNewSubtaskTitleChange}
        onAddSubtask={onAddSubtask}
        onSubtaskKeyDown={onSubtaskKeyDown}
        aiEnabled={true}
        onGenerateClick={onGenerateClick}
        maxSubtasks={25}
      />,
    );

    expect(
      screen.getByRole("button", { name: /generate subtasks/i }),
    ).toBeDisabled();
  });
});
