import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnManager } from "./column-manager";
import type { Column } from "@/types";

// jsdom doesn't support full DnD APIs
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "doing", name: "Doing", order: 1, wipLimit: 3 },
];

describe("ColumnManager — WIP limit input", () => {
  it("renders a WIP limit input per column, pre-filled with existing value", () => {
    render(<ColumnManager columns={columns} onSave={vi.fn()} />);

    expect(
      screen.getByLabelText("WIP limit for To Do"),
    ).toHaveValue(null);
    expect(screen.getByLabelText("WIP limit for Doing")).toHaveValue(3);
  });

  it("saves the entered WIP limit through onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ColumnManager columns={columns} onSave={onSave} />);

    const input = screen.getByLabelText("WIP limit for To Do");
    await userEvent.type(input, "5");

    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as Column[];
    expect(saved.find((c) => c.id === "todo")?.wipLimit).toBe(5);
  });

  it("clears the WIP limit to undefined when the input is emptied", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ColumnManager columns={columns} onSave={onSave} />);

    const input = screen.getByLabelText("WIP limit for Doing");
    await userEvent.clear(input);

    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );

    const saved = onSave.mock.calls[0][0] as Column[];
    expect(saved.find((c) => c.id === "doing")?.wipLimit).toBeUndefined();
  });
});
