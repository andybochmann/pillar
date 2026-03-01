import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkActionsBar } from "./bulk-actions-bar";
import type { Column, Label, ProjectMember } from "@/types";

const mockColumns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "done", name: "Done", order: 1 },
];

const mockLabels: Label[] = [
  {
    _id: "label-1",
    name: "Bug",
    color: "#ef4444",
    userId: "user-1",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    _id: "label-2",
    name: "Feature",
    color: "#22c55e",
    userId: "user-1",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

const mockMembers: ProjectMember[] = [
  {
    _id: "pm-1",
    projectId: "proj-1",
    userId: "user-1",
    role: "owner",
    invitedBy: "user-1",
    userName: "Owner User",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    _id: "pm-2",
    projectId: "proj-1",
    userId: "user-2",
    role: "editor",
    invitedBy: "user-1",
    userName: "Editor User",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

describe("BulkActionsBar", () => {
  let onClearSelection: ReturnType<typeof vi.fn>;
  let onBulkMove: ReturnType<typeof vi.fn>;
  let onBulkPriority: ReturnType<typeof vi.fn>;
  let onBulkDelete: ReturnType<typeof vi.fn>;
  let onBulkArchive: ReturnType<typeof vi.fn>;
  let onBulkSetDueDate: ReturnType<typeof vi.fn>;
  let onBulkAssign: ReturnType<typeof vi.fn>;
  let onBulkAddLabel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClearSelection = vi.fn();
    onBulkMove = vi.fn().mockResolvedValue(undefined);
    onBulkPriority = vi.fn().mockResolvedValue(undefined);
    onBulkDelete = vi.fn().mockResolvedValue(undefined);
    onBulkArchive = vi.fn().mockResolvedValue(undefined);
    onBulkSetDueDate = vi.fn().mockResolvedValue(undefined);
    onBulkAssign = vi.fn().mockResolvedValue(undefined);
    onBulkAddLabel = vi.fn().mockResolvedValue(undefined);
  });

  function renderBar(overrides = {}) {
    return render(
      <BulkActionsBar
        selectedCount={3}
        totalCount={10}
        columns={mockColumns}
        labels={mockLabels}
        members={mockMembers}
        onClearSelection={onClearSelection}
        onBulkMove={onBulkMove}
        onBulkPriority={onBulkPriority}
        onBulkArchive={onBulkArchive}
        onBulkDelete={onBulkDelete}
        onBulkSetDueDate={onBulkSetDueDate}
        onBulkAssign={onBulkAssign}
        onBulkAddLabel={onBulkAddLabel}
        {...overrides}
      />,
    );
  }

  it("renders nothing when no tasks selected", () => {
    const { container } = renderBar({ selectedCount: 0 });
    expect(container.innerHTML).toBe("");
  });

  it("shows 'X of Y tasks selected' count", () => {
    renderBar();
    expect(screen.getByText("3 of 10 tasks selected")).toBeInTheDocument();
  });

  it("calls onClearSelection when cancel clicked", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("calls onBulkDelete when delete clicked", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onBulkDelete).toHaveBeenCalled();
  });

  it("shows move and priority selects", () => {
    renderBar();
    expect(screen.getByLabelText("Move to column")).toBeInTheDocument();
    expect(screen.getByLabelText("Set priority")).toBeInTheDocument();
  });

  it("renders due date button", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: /set due date/i }),
    ).toBeInTheDocument();
  });

  it("renders assign button when members exist", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: /assign/i }),
    ).toBeInTheDocument();
  });

  it("does not render assign button when no members", () => {
    renderBar({ members: [] });
    expect(
      screen.queryByRole("button", { name: /assign/i }),
    ).not.toBeInTheDocument();
  });

  it("renders label button", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: /add label/i }),
    ).toBeInTheDocument();
  });

  it("renders archive button", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: "Archive" }),
    ).toBeInTheDocument();
  });
});
