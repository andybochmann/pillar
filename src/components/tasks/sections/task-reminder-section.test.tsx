import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskReminderSection } from "./task-reminder-section";

describe("TaskReminderSection", () => {
  let onReminderChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onReminderChange = vi.fn();
  });

  it("renders reminder label and date-time picker", () => {
    render(
      <TaskReminderSection
        reminderAt=""
        onReminderChange={onReminderChange}
      />,
    );

    expect(screen.getByText("Reminder")).toBeInTheDocument();
    expect(screen.getByText("Pick date & time")).toBeInTheDocument();
  });

  it("renders with empty reminder showing placeholder", () => {
    render(
      <TaskReminderSection
        reminderAt=""
        onReminderChange={onReminderChange}
      />,
    );

    expect(screen.getByText("Pick date & time")).toBeInTheDocument();
  });

  it("renders with specified reminder datetime", () => {
    render(
      <TaskReminderSection
        reminderAt="2026-03-15T10:30"
        onReminderChange={onReminderChange}
      />,
    );

    expect(
      screen.getByText("Mar 15, 2026 at 10:30 AM"),
    ).toBeInTheDocument();
  });

  it("shows clear button when reminder is set", () => {
    render(
      <TaskReminderSection
        reminderAt="2026-03-15T10:30"
        onReminderChange={onReminderChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: /clear date and time/i }),
    ).toBeInTheDocument();
  });

  it("does not show clear button when reminder is empty", () => {
    render(
      <TaskReminderSection
        reminderAt=""
        onReminderChange={onReminderChange}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /clear date and time/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onReminderChange with empty string when clear is clicked", async () => {
    const user = userEvent.setup();

    render(
      <TaskReminderSection
        reminderAt="2026-03-15T10:30"
        onReminderChange={onReminderChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /clear date and time/i }),
    );
    expect(onReminderChange).toHaveBeenCalledWith("");
  });
});
