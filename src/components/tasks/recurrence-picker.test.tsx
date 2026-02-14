import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurrencePicker, getPreviewText } from "./recurrence-picker";
import type { Recurrence } from "@/types";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("RecurrencePicker", () => {
  const defaultValue: Recurrence = {
    frequency: "none",
    interval: 1,
  };

  it("renders frequency select", () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value={defaultValue} onChange={onChange} />);
    expect(screen.getByLabelText("Recurrence frequency")).toBeInTheDocument();
  });

  it("hides interval and end date when frequency is none", () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value={defaultValue} onChange={onChange} />);
    expect(
      screen.queryByLabelText("Recurrence interval"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Recurrence end date"),
    ).not.toBeInTheDocument();
  });

  it("shows interval and end date when frequency is not none", () => {
    const onChange = vi.fn();
    render(
      <RecurrencePicker
        value={{ frequency: "weekly", interval: 1 }}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Recurrence interval")).toBeInTheDocument();
    expect(screen.getByLabelText("Recurrence end date")).toBeInTheDocument();
  });

  it("shows preview text for weekly recurrence", () => {
    const onChange = vi.fn();
    render(
      <RecurrencePicker
        value={{ frequency: "weekly", interval: 2 }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Repeats every 2 weeks")).toBeInTheDocument();
  });

  it("shows preview text with end date", () => {
    const onChange = vi.fn();
    render(
      <RecurrencePicker
        value={{
          frequency: "daily",
          interval: 1,
          endDate: "2026-03-15T00:00:00.000Z",
        }}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByText("Repeats every day until Mar 15, 2026"),
    ).toBeInTheDocument();
  });

  it("calls onChange when interval changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <RecurrencePicker
        value={{ frequency: "weekly", interval: 1 }}
        onChange={onChange}
      />,
    );

    // Simulate what a parent component would do: update value on change
    onChange.mockImplementation((rec) => {
      rerender(<RecurrencePicker value={rec} onChange={onChange} />);
    });

    const intervalInput = screen.getByLabelText("Recurrence interval");
    await user.tripleClick(intervalInput);
    await user.keyboard("3");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ frequency: "weekly", interval: 3 }),
    );
  });

  it("calls onChange with end date", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecurrencePicker
        value={{ frequency: "weekly", interval: 1 }}
        onChange={onChange}
      />,
    );

    const endDateInput = screen.getByLabelText("Recurrence end date");
    await user.type(endDateInput, "2026-06-01");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        endDate: expect.stringContaining("2026-06-01"),
      }),
    );
  });
});

describe("getPreviewText", () => {
  it("returns null for none frequency", () => {
    expect(getPreviewText({ frequency: "none", interval: 1 })).toBeNull();
  });

  it("returns singular for interval 1", () => {
    expect(getPreviewText({ frequency: "daily", interval: 1 })).toBe(
      "Repeats every day",
    );
  });

  it("returns plural for interval > 1", () => {
    expect(getPreviewText({ frequency: "monthly", interval: 3 })).toBe(
      "Repeats every 3 months",
    );
  });

  it("includes end date when present", () => {
    expect(
      getPreviewText({
        frequency: "yearly",
        interval: 1,
        endDate: "2027-01-15T00:00:00.000Z",
      }),
    ).toBe("Repeats every year until Jan 15, 2027");
  });
});
