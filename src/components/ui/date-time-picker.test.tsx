import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTimePicker } from "./date-time-picker";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DateTimePicker", () => {
  it("renders placeholder when no value", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("Pick date & time");
  });

  it("renders custom placeholder", () => {
    render(
      <DateTimePicker
        value=""
        onChange={vi.fn()}
        placeholder="Set reminder"
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Set reminder");
  });

  it("renders formatted datetime when value provided", () => {
    render(<DateTimePicker value="2026-03-15T14:30" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent(
      "Mar 15, 2026 at 2:30 PM",
    );
  });

  it("opens popover on click with calendar and time input", async () => {
    const user = userEvent.setup();
    render(<DateTimePicker value="2026-03-15T14:30" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Time")).toBeInTheDocument();
  });

  it("calls onChange with datetime string on day selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker value="2026-03-15T14:30" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button"));
    const day20Cell = screen.getByRole("gridcell", { name: "20" });
    await user.click(within(day20Cell).getByRole("button"));

    // Should preserve the existing time
    expect(onChange).toHaveBeenCalledWith("2026-03-20T14:30");
  });

  it("does not show clear button by default", () => {
    render(
      <DateTimePicker value="2026-03-15T14:30" onChange={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: /clear date/i }),
    ).not.toBeInTheDocument();
  });

  it("shows clear button when clearable and value set", () => {
    render(
      <DateTimePicker
        value="2026-03-15T14:30"
        onChange={vi.fn()}
        clearable
      />,
    );
    expect(
      screen.getByRole("button", { name: /clear date and time/i }),
    ).toBeInTheDocument();
  });

  it("calls onChange with empty string when clear clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateTimePicker
        value="2026-03-15T14:30"
        onChange={onChange}
        clearable
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /clear date and time/i }),
    );
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("time input is disabled when no date selected", async () => {
    const user = userEvent.setup();
    render(<DateTimePicker value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByLabelText("Time")).toBeDisabled();
  });

  it("time input is enabled when date is selected", async () => {
    const user = userEvent.setup();
    render(
      <DateTimePicker value="2026-03-15T14:30" onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("button"));
    expect(screen.getByLabelText("Time")).not.toBeDisabled();
  });

  it("formats AM time correctly", () => {
    render(<DateTimePicker value="2026-03-15T09:05" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent(
      "Mar 15, 2026 at 9:05 AM",
    );
  });

  it("formats noon correctly", () => {
    render(<DateTimePicker value="2026-03-15T12:00" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent(
      "Mar 15, 2026 at 12:00 PM",
    );
  });

  it("formats midnight correctly", () => {
    render(<DateTimePicker value="2026-03-15T00:00" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent(
      "Mar 15, 2026 at 12:00 AM",
    );
  });
});
