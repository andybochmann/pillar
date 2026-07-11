import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format, addDays } from "date-fns";
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

  describe("quick-select chips", () => {
    it("shows Today / Tomorrow / Next week chips when open", async () => {
      const user = userEvent.setup();
      render(<DatePicker value="" onChange={vi.fn()} />);
      await user.click(screen.getByRole("button"));
      expect(
        screen.getByRole("button", { name: "Today" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Tomorrow" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Next week" }),
      ).toBeInTheDocument();
    });

    it("Today chip sets today's date and closes the popover", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DatePicker value="" onChange={onChange} />);
      await user.click(screen.getByRole("button", { name: /pick a date/i }));
      await user.click(screen.getByRole("button", { name: "Today" }));
      expect(onChange).toHaveBeenCalledWith(format(new Date(), "yyyy-MM-dd"));
      expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    });

    it("Tomorrow chip sets today + 1 day", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DatePicker value="" onChange={onChange} />);
      await user.click(screen.getByRole("button", { name: /pick a date/i }));
      await user.click(screen.getByRole("button", { name: "Tomorrow" }));
      expect(onChange).toHaveBeenCalledWith(
        format(addDays(new Date(), 1), "yyyy-MM-dd"),
      );
    });

    it("Next week chip sets today + 7 days", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DatePicker value="" onChange={onChange} />);
      await user.click(screen.getByRole("button", { name: /pick a date/i }));
      await user.click(screen.getByRole("button", { name: "Next week" }));
      expect(onChange).toHaveBeenCalledWith(
        format(addDays(new Date(), 7), "yyyy-MM-dd"),
      );
    });

    it("shows a Clear chip only when clearable with a value", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <DatePicker value="2026-03-15" onChange={onChange} clearable />,
      );
      await user.click(screen.getByRole("button", { name: "Mar 15, 2026" }));
      const clearChip = screen.getByRole("button", { name: /^clear$/i });
      await user.click(clearChip);
      expect(onChange).toHaveBeenCalledWith("");
      expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    });
  });
});
