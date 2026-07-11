import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "./task-card";

// Mock @dnd-kit since jsdom doesn't support full DnD APIs
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

const baseTask = {
  _id: "task-1",
  title: "Deploy release",
  columnId: "todo",
  priority: "high" as const,
  order: 0,
  labels: [],
  subtasks: [],
  timeSessions: [],
  blockedBy: [] as string[],
};

describe("TaskCard blocked badge", () => {
  it("does not render a blocked badge when there are no blockers", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.queryByTestId("blocked-badge")).not.toBeInTheDocument();
  });

  it("renders the badge with a count when a blocker is open", () => {
    const tasksById = new Map([["blk-1", { completedAt: null }]]);
    render(
      <TaskCard
        task={{ ...baseTask, blockedBy: ["blk-1"] }}
        tasksById={tasksById}
      />,
    );
    const badge = screen.getByTestId("blocked-badge");
    expect(badge).toHaveTextContent("1");
    expect(badge).toHaveAttribute("aria-label", "Blocked by 1 open task");
  });

  it("counts multiple open blockers and pluralises the label", () => {
    const tasksById = new Map([
      ["blk-1", { completedAt: null }],
      ["blk-2", { completedAt: null }],
    ]);
    render(
      <TaskCard
        task={{ ...baseTask, blockedBy: ["blk-1", "blk-2"] }}
        tasksById={tasksById}
      />,
    );
    expect(screen.getByTestId("blocked-badge")).toHaveAttribute(
      "aria-label",
      "Blocked by 2 open tasks",
    );
  });

  it("does not render the badge when all blockers are completed", () => {
    const tasksById = new Map([
      ["blk-1", { completedAt: "2026-01-01T00:00:00Z" }],
    ]);
    render(
      <TaskCard
        task={{ ...baseTask, blockedBy: ["blk-1"] }}
        tasksById={tasksById}
      />,
    );
    expect(screen.queryByTestId("blocked-badge")).not.toBeInTheDocument();
  });

  it("does not render the badge when the only blocker is archived", () => {
    const tasksById = new Map([["blk-1", { archived: true }]]);
    render(
      <TaskCard
        task={{ ...baseTask, blockedBy: ["blk-1"] }}
        tasksById={tasksById}
      />,
    );
    expect(screen.queryByTestId("blocked-badge")).not.toBeInTheDocument();
  });

  it("shows a generic blocked state when blocker state is unknown (no lookup)", () => {
    render(<TaskCard task={{ ...baseTask, blockedBy: ["blk-1"] }} />);
    const badge = screen.getByTestId("blocked-badge");
    expect(badge).toHaveTextContent("Blocked");
    expect(badge).toHaveAttribute("aria-label", "Blocked by other tasks");
  });

  it("treats an unresolved blocker as resolved when a lookup is provided", () => {
    // A deleted/archived blocker is absent from the board lookup — with a lookup
    // present, that means it no longer blocks (no false 'Blocked' badge).
    const tasksById = new Map([["other", { completedAt: null }]]);
    render(
      <TaskCard
        task={{ ...baseTask, blockedBy: ["deleted-blocker"] }}
        tasksById={tasksById}
      />,
    );
    expect(screen.queryByTestId("blocked-badge")).not.toBeInTheDocument();
  });
});
