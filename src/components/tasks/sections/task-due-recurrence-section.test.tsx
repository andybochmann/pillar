import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskDueRecurrenceSection } from "./task-due-recurrence-section";
import type { Recurrence } from "@/types";

describe("TaskDueRecurrenceSection", () => {
  let onDueDateChange: ReturnType<typeof vi.fn>;
  let onRecurrenceChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDueDateChange = vi.fn();
    onRecurrenceChange = vi.fn();
  });

  const defaultRecurrence: Recurrence = {
    frequency: "none",
    interval: 1,
  };

  it("renders due date and recurrence labels", () => {
    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={defaultRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    expect(screen.getByText("Due Date")).toBeInTheDocument();
    expect(screen.getByText("Recurrence")).toBeInTheDocument();
  });

  it("renders due date picker with placeholder when empty", () => {
    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={defaultRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    expect(screen.getByText("Pick a date")).toBeInTheDocument();
  });

  it("renders with specified due date", () => {
    render(
      <TaskDueRecurrenceSection
        dueDate="2024-12-31"
        recurrence={defaultRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    expect(screen.getByText("Dec 31, 2024")).toBeInTheDocument();
  });

  it("renders RecurrencePicker with none frequency", () => {
    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={defaultRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    // RecurrencePicker renders a select for frequency
    const frequencySelect = screen.getByLabelText("Recurrence frequency");
    expect(frequencySelect).toBeInTheDocument();
  });

  it("renders RecurrencePicker with daily frequency", () => {
    const dailyRecurrence: Recurrence = {
      frequency: "daily",
      interval: 1,
    };

    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={dailyRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    // RecurrencePicker renders interval input for non-none frequencies
    const intervalInput = screen.getByLabelText("Recurrence interval");
    expect(intervalInput).toBeInTheDocument();
  });

  it("renders RecurrencePicker with weekly frequency", () => {
    const weeklyRecurrence: Recurrence = {
      frequency: "weekly",
      interval: 2,
    };

    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={weeklyRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    const intervalInput = screen.getByLabelText("Recurrence interval");
    expect(intervalInput).toBeInTheDocument();
  });

  it("renders RecurrencePicker with monthly frequency", () => {
    const monthlyRecurrence: Recurrence = {
      frequency: "monthly",
      interval: 3,
    };

    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={monthlyRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    const intervalInput = screen.getByLabelText("Recurrence interval");
    expect(intervalInput).toBeInTheDocument();
  });

  it("renders RecurrencePicker with yearly frequency", () => {
    const yearlyRecurrence: Recurrence = {
      frequency: "yearly",
      interval: 1,
    };

    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={yearlyRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    const intervalInput = screen.getByLabelText("Recurrence interval");
    expect(intervalInput).toBeInTheDocument();
  });

  it("renders in a grid layout with two columns", () => {
    const { container } = render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={defaultRecurrence}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    const gridElement = container.querySelector(".grid.grid-cols-2");
    expect(gridElement).toBeInTheDocument();
  });

  it("renders with recurrence end date", () => {
    const recurrenceWithEndDate: Recurrence = {
      frequency: "daily",
      interval: 1,
      endDate: "2024-12-31T00:00:00Z",
    };

    render(
      <TaskDueRecurrenceSection
        dueDate=""
        recurrence={recurrenceWithEndDate}
        onDueDateChange={onDueDateChange}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );

    // RecurrencePicker shows end date picker for non-none frequencies
    expect(
      screen.getByRole("button", { name: /recurrence end date/i }),
    ).toBeInTheDocument();
  });
});
