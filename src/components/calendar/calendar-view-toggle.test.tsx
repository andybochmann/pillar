import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarViewToggle } from "./calendar-view-toggle";
import type { CalendarViewType } from "@/types";

describe("CalendarViewToggle", () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    viewType: "month" as CalendarViewType,
    onChange: mockOnChange,
  };

  it("renders all three view options", () => {
    render(<CalendarViewToggle {...defaultProps} />);

    expect(screen.getByRole("button", { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /day/i })).toBeInTheDocument();
  });

  it("shows month view as active when viewType is month", () => {
    render(<CalendarViewToggle {...defaultProps} viewType="month" />);

    const monthButton = screen.getByRole("button", { name: /month/i });
    const weekButton = screen.getByRole("button", { name: /week/i });
    const dayButton = screen.getByRole("button", { name: /day/i });

    expect(monthButton).toHaveAttribute("aria-pressed", "true");
    expect(weekButton).toHaveAttribute("aria-pressed", "false");
    expect(dayButton).toHaveAttribute("aria-pressed", "false");
  });

  it("shows week view as active when viewType is week", () => {
    render(<CalendarViewToggle {...defaultProps} viewType="week" />);

    const monthButton = screen.getByRole("button", { name: /month/i });
    const weekButton = screen.getByRole("button", { name: /week/i });
    const dayButton = screen.getByRole("button", { name: /day/i });

    expect(monthButton).toHaveAttribute("aria-pressed", "false");
    expect(weekButton).toHaveAttribute("aria-pressed", "true");
    expect(dayButton).toHaveAttribute("aria-pressed", "false");
  });

  it("shows day view as active when viewType is day", () => {
    render(<CalendarViewToggle {...defaultProps} viewType="day" />);

    const monthButton = screen.getByRole("button", { name: /month/i });
    const weekButton = screen.getByRole("button", { name: /week/i });
    const dayButton = screen.getByRole("button", { name: /day/i });

    expect(monthButton).toHaveAttribute("aria-pressed", "false");
    expect(weekButton).toHaveAttribute("aria-pressed", "false");
    expect(dayButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange with month when month button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CalendarViewToggle {...defaultProps} viewType="week" onChange={onChange} />);

    const monthButton = screen.getByRole("button", { name: /month/i });
    await user.click(monthButton);

    expect(onChange).toHaveBeenCalledWith("month");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onChange with week when week button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CalendarViewToggle {...defaultProps} viewType="month" onChange={onChange} />);

    const weekButton = screen.getByRole("button", { name: /week/i });
    await user.click(weekButton);

    expect(onChange).toHaveBeenCalledWith("week");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onChange with day when day button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CalendarViewToggle {...defaultProps} viewType="month" onChange={onChange} />);

    const dayButton = screen.getByRole("button", { name: /day/i });
    await user.click(dayButton);

    expect(onChange).toHaveBeenCalledWith("day");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("renders with correct test id", () => {
    render(<CalendarViewToggle {...defaultProps} />);

    expect(screen.getByTestId("calendar-view-toggle")).toBeInTheDocument();
  });

  it("displays icons for each view option", () => {
    render(<CalendarViewToggle {...defaultProps} />);

    const monthButton = screen.getByRole("button", { name: /month/i });
    const weekButton = screen.getByRole("button", { name: /week/i });
    const dayButton = screen.getByRole("button", { name: /day/i });

    // Check that buttons contain icons (lucide icons render as svg elements)
    expect(monthButton.querySelector("svg")).toBeInTheDocument();
    expect(weekButton.querySelector("svg")).toBeInTheDocument();
    expect(dayButton.querySelector("svg")).toBeInTheDocument();
  });
});
