import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BoardFilterBar,
  EMPTY_FILTERS,
  type BoardFilters,
} from "./board-filter-bar";
import type { Label } from "@/types";

const mockLabels: Label[] = [
  {
    _id: "lbl-1",
    name: "Bug",
    color: "#ef4444",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "lbl-2",
    name: "Feature",
    color: "#3b82f6",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
];

describe("BoardFilterBar", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it("renders filter button", () => {
    render(
      <BoardFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("shows active count in button", () => {
    const filters: BoardFilters = {
      priorities: ["high", "urgent"],
      labels: [],
      dueDateRange: null,
    };
    render(
      <BoardFilterBar
        filters={filters}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Filters (2)" }),
    ).toBeInTheDocument();
  });

  it("shows clear button when filters active", () => {
    const filters: BoardFilters = {
      priorities: ["high"],
      labels: [],
      dueDateRange: null,
    };
    render(
      <BoardFilterBar
        filters={filters}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Clear filters" }),
    ).toBeInTheDocument();
  });

  it("clears all filters", async () => {
    const user = userEvent.setup();
    const filters: BoardFilters = {
      priorities: ["high"],
      labels: ["Bug"],
      dueDateRange: "today",
    };
    render(
      <BoardFilterBar
        filters={filters}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });

  it("opens popover and shows priority buttons", async () => {
    const user = userEvent.setup();
    render(
      <BoardFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByRole("button", { name: "urgent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "high" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "medium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "low" })).toBeInTheDocument();
  });

  it("toggles a priority filter", async () => {
    const user = userEvent.setup();
    render(
      <BoardFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "high" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      priorities: ["high"],
    });
  });

  it("removes a priority when already selected", async () => {
    const user = userEvent.setup();
    const filters: BoardFilters = {
      priorities: ["high"],
      labels: [],
      dueDateRange: null,
    };
    render(
      <BoardFilterBar
        filters={filters}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters (1)" }));
    await user.click(screen.getByRole("button", { name: "high" }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, priorities: [] });
  });

  it("shows label filter buttons", async () => {
    const user = userEvent.setup();
    render(
      <BoardFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByRole("button", { name: "Bug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feature" })).toBeInTheDocument();
  });

  it("toggles a label filter", async () => {
    const user = userEvent.setup();
    render(
      <BoardFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Bug" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      labels: ["Bug"],
    });
  });

  it("shows due date filter buttons", async () => {
    const user = userEvent.setup();
    render(
      <BoardFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByRole("button", { name: "Overdue" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Due today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Due this week" }),
    ).toBeInTheDocument();
  });

  it("toggles due date range", async () => {
    const user = userEvent.setup();
    render(
      <BoardFilterBar
        filters={EMPTY_FILTERS}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Overdue" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      dueDateRange: "overdue",
    });
  });

  it("deselects due date range when clicking same option", async () => {
    const user = userEvent.setup();
    const filters: BoardFilters = {
      priorities: [],
      labels: [],
      dueDateRange: "overdue",
    };
    render(
      <BoardFilterBar
        filters={filters}
        onChange={onChange}
        allLabels={mockLabels}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters (1)" }));
    await user.click(screen.getByRole("button", { name: "Overdue" }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      dueDateRange: null,
    });
  });
});
