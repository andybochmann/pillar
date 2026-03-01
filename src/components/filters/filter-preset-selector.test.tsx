import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterPresetSelector } from "./filter-preset-selector";

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

const mockPresets = [
  {
    _id: "preset-1",
    name: "Urgent Tasks",
    context: "overview",
    filters: { priority: "urgent" },
    userId: "user-1",
    order: 0,
    createdAt: "",
    updatedAt: "",
  },
];

describe("FilterPresetSelector", () => {
  const onApply = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    onApply.mockClear();
  });

  it("renders the Presets button", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    render(
      <FilterPresetSelector
        context="overview"
        currentFilters={{}}
        onApply={onApply}
      />,
    );

    expect(screen.getByTestId("preset-selector-trigger")).toHaveTextContent(
      "Presets",
    );
  });

  it("shows preset count in trigger button", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    } as Response);

    render(
      <FilterPresetSelector
        context="overview"
        currentFilters={{}}
        onApply={onApply}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("preset-selector-trigger")).toHaveTextContent(
        "(1)",
      );
    });
  });

  it("shows presets in popover and applies on click", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    } as Response);

    const user = userEvent.setup();

    render(
      <FilterPresetSelector
        context="overview"
        currentFilters={{}}
        onApply={onApply}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("preset-selector-trigger")).toHaveTextContent(
        "(1)",
      );
    });

    await user.click(screen.getByTestId("preset-selector-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("preset-preset-1")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("preset-preset-1"));

    expect(onApply).toHaveBeenCalledWith({ priority: "urgent" });
  });

  it("shows save button when there are active filters", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const user = userEvent.setup();

    render(
      <FilterPresetSelector
        context="overview"
        currentFilters={{ priority: "high" }}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByTestId("preset-selector-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("save-preset-button")).toBeInTheDocument();
    });
  });

  it("does not show save button when no active filters", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const user = userEvent.setup();

    render(
      <FilterPresetSelector
        context="overview"
        currentFilters={{}}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByTestId("preset-selector-trigger"));

    await waitFor(() => {
      expect(screen.getByText("No saved presets")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("save-preset-button")).not.toBeInTheDocument();
  });
});
