import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskForm } from "./task-form";

describe("TaskForm", () => {
  const defaultProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  };

  it("renders input with placeholder", () => {
    render(<TaskForm {...defaultProps} />);
    expect(screen.getByLabelText("New task title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Task title…")).toBeInTheDocument();
  });

  it("auto-focuses the input", () => {
    render(<TaskForm {...defaultProps} />);
    expect(screen.getByLabelText("New task title")).toHaveFocus();
  });

  it("submits on Enter with trimmed title", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm {...defaultProps} onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText("New task title"),
      "  New task  {Enter}",
    );
    expect(onSubmit).toHaveBeenCalledWith("New task");
  });

  it("does not submit when empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm {...defaultProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("New task title"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel on Escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<TaskForm {...defaultProps} onCancel={onCancel} />);

    await user.type(screen.getByLabelText("New task title"), "{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("clears input after successful submit", async () => {
    const user = userEvent.setup();
    render(<TaskForm {...defaultProps} />);

    const input = screen.getByLabelText("New task title");
    await user.type(input, "New task{Enter}");
    expect(input).toHaveValue("");
  });
});
