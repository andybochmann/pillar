import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "./task-card";

// Mock @dnd-kit/sortable since jsdom doesn't support full DnD APIs
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
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

describe("TaskCard", () => {
  const baseTask = {
    _id: "task-1",
    title: "Fix login bug",
    columnId: "todo",
    priority: "high" as const,
    order: 0,
    labels: [],
  };

  it("renders task title", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders urgent priority", () => {
    render(<TaskCard task={{ ...baseTask, priority: "urgent" }} />);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("renders labels", () => {
    render(<TaskCard task={{ ...baseTask, labels: ["bug", "critical"] }} />);
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("renders recurring task indicator", () => {
    render(
      <TaskCard task={{ ...baseTask, recurrence: { frequency: "weekly" } }} />,
    );
    expect(screen.getByText("↻")).toBeInTheDocument();
  });

  it("does not render recurring indicator for non-recurring tasks", () => {
    render(
      <TaskCard task={{ ...baseTask, recurrence: { frequency: "none" } }} />,
    );
    expect(screen.queryByText("↻")).not.toBeInTheDocument();
  });

  it("renders overdue date styling", () => {
    const pastDate = new Date("2025-01-15T12:00:00Z").toISOString();
    render(<TaskCard task={{ ...baseTask, dueDate: pastDate }} />);
    expect(screen.getByText("Jan 15")).toBeInTheDocument();
  });

  it("applies overlay styling when isOverlay is true", () => {
    const { container } = render(<TaskCard task={baseTask} isOverlay />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rotate-2");
  });
});
