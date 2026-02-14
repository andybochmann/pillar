import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkActionsBar } from "./bulk-actions-bar";
import type { Column } from "@/types";

const mockColumns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "done", name: "Done", order: 1 },
];

describe("BulkActionsBar", () => {
  let onClearSelection: ReturnType<typeof vi.fn>;
  let onBulkMove: ReturnType<typeof vi.fn>;
  let onBulkPriority: ReturnType<typeof vi.fn>;
  let onBulkDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClearSelection = vi.fn();
    onBulkMove = vi.fn().mockResolvedValue(undefined);
    onBulkPriority = vi.fn().mockResolvedValue(undefined);
    onBulkDelete = vi.fn().mockResolvedValue(undefined);
  });

  it("renders nothing when no tasks selected", () => {
    const { container } = render(
      <BulkActionsBar
        selectedCount={0}
        columns={mockColumns}
        onClearSelection={onClearSelection}
        onBulkMove={onBulkMove}
        onBulkPriority={onBulkPriority}
        onBulkDelete={onBulkDelete}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows selected count", () => {
    render(
      <BulkActionsBar
        selectedCount={3}
        columns={mockColumns}
        onClearSelection={onClearSelection}
        onBulkMove={onBulkMove}
        onBulkPriority={onBulkPriority}
        onBulkDelete={onBulkDelete}
      />,
    );
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("calls onClearSelection when cancel clicked", async () => {
    const user = userEvent.setup();
    render(
      <BulkActionsBar
        selectedCount={2}
        columns={mockColumns}
        onClearSelection={onClearSelection}
        onBulkMove={onBulkMove}
        onBulkPriority={onBulkPriority}
        onBulkDelete={onBulkDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("calls onBulkDelete when delete clicked", async () => {
    const user = userEvent.setup();
    render(
      <BulkActionsBar
        selectedCount={2}
        columns={mockColumns}
        onClearSelection={onClearSelection}
        onBulkMove={onBulkMove}
        onBulkPriority={onBulkPriority}
        onBulkDelete={onBulkDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onBulkDelete).toHaveBeenCalled();
  });

  it("shows move and priority selects", () => {
    render(
      <BulkActionsBar
        selectedCount={2}
        columns={mockColumns}
        onClearSelection={onClearSelection}
        onBulkMove={onBulkMove}
        onBulkPriority={onBulkPriority}
        onBulkDelete={onBulkDelete}
      />,
    );
    expect(screen.getByLabelText("Move to column")).toBeInTheDocument();
    expect(screen.getByLabelText("Set priority")).toBeInTheDocument();
  });
});
