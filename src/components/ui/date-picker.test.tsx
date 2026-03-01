import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./date-picker";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DatePicker", () => {
  it("renders placeholder when no value", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("Pick a date");
  });

  it("renders custom placeholder", () => {
    render(
      <DatePicker value="" onChange={vi.fn()} placeholder="Select due date" />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Select due date");
  });

  it("renders formatted date when value provided", () => {
    render(<DatePicker value="2026-03-15" onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("Mar 15, 2026");
  });

  it("opens calendar popover on click", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    // Calendar renders a grid (the day table)
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("calls onChange with YYYY-MM-DD string on day selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-03-15" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    // Click the button inside the day 20 gridcell
    const day20Cell = screen.getByRole("gridcell", { name: "20" });
    await user.click(within(day20Cell).getByRole("button"));

    expect(onChange).toHaveBeenCalledWith("2026-03-20");
  });

  it("closes popover after day selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-03-15" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("grid")).toBeInTheDocument();

    const day20Cell = screen.getByRole("gridcell", { name: "20" });
    await user.click(within(day20Cell).getByRole("button"));

    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("does not show clear button when clearable is false", () => {
    render(<DatePicker value="2026-03-15" onChange={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /clear date/i }),
    ).not.toBeInTheDocument();
  });

  it("shows clear button when clearable and value set", () => {
    render(
      <DatePicker value="2026-03-15" onChange={vi.fn()} clearable />,
    );
    expect(
      screen.getByRole("button", { name: /clear date/i }),
    ).toBeInTheDocument();
  });

  it("does not show clear button when clearable but no value", () => {
    render(<DatePicker value="" onChange={vi.fn()} clearable />);
    expect(
      screen.queryByRole("button", { name: /clear date/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onChange with empty string when clear clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker value="2026-03-15" onChange={onChange} clearable />,
    );

    await user.click(
      screen.getByRole("button", { name: /clear date/i }),
    );
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("sets id on trigger button", () => {
    render(
      <DatePicker value="" onChange={vi.fn()} id="my-date" />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("id", "my-date");
  });

  it("sets aria-label on trigger button", () => {
    render(
      <DatePicker
        value=""
        onChange={vi.fn()}
        ariaLabel="Select a date"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Select a date" }),
    ).toBeInTheDocument();
  });
});
