import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskReminderSection } from "./task-reminder-section";

describe("TaskReminderSection", () => {
  let onReminderChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onReminderChange = vi.fn();
  });

  it("renders reminder label and datetime input", () => {
    render(
      <TaskReminderSection
        reminderAt=""
        onReminderChange={onReminderChange}
      />,
    );

    expect(screen.getByText("Reminder")).toBeInTheDocument();
    const input = screen.getByLabelText("Reminder");
    expect(input).toHaveAttribute("type", "datetime-local");
  });

  it("renders with empty reminder", () => {
    render(
      <TaskReminderSection
        reminderAt=""
        onReminderChange={onReminderChange}
      />,
    );

    const input = screen.getByLabelText("Reminder") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("renders with specified reminder datetime", () => {
    render(
      <TaskReminderSection
        reminderAt="2026-03-15T10:30"
        onReminderChange={onReminderChange}
      />,
    );

    const input = screen.getByLabelText("Reminder") as HTMLInputElement;
    expect(input.value).toBe("2026-03-15T10:30");
  });

  it("shows clear button when reminder is set", () => {
    render(
      <TaskReminderSection
        reminderAt="2026-03-15T10:30"
        onReminderChange={onReminderChange}
      />,
    );

    expect(screen.getByRole("button", { name: /clear reminder/i })).toBeInTheDocument();
  });

  it("does not show clear button when reminder is empty", () => {
    render(
      <TaskReminderSection
        reminderAt=""
        onReminderChange={onReminderChange}
      />,
    );

    expect(screen.queryByRole("button", { name: /clear reminder/i })).not.toBeInTheDocument();
  });

  it("calls onReminderChange with empty string when clear is clicked", async () => {
    const user = userEvent.setup();

    render(
      <TaskReminderSection
        reminderAt="2026-03-15T10:30"
        onReminderChange={onReminderChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /clear reminder/i }));
    expect(onReminderChange).toHaveBeenCalledWith("");
  });
});
