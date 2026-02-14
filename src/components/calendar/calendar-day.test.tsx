import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarDay } from "./calendar-day";
import type { Task } from "@/types";

// Mock @dnd-kit hooks
vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}));

const mockTasks: Task[] = [
  {
    _id: "task-1",
    title: "Task one",
    projectId: "p1",
    userId: "u1",
    columnId: "todo",
    priority: "urgent",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 0,
    labels: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-2",
    title: "Task two",
    projectId: "p1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 1,
    labels: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-3",
    title: "Task three",
    projectId: "p1",
    userId: "u1",
    columnId: "todo",
    priority: "low",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 2,
    labels: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-4",
    title: "Task four overflow",
    projectId: "p1",
    userId: "u1",
    columnId: "todo",
    priority: "high",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 3,
    labels: [],
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CalendarDay", () => {
  const defaultProps = {
    date: new Date(2026, 1, 15),
    tasks: [] as Task[],
    isCurrentMonth: true,
    onDateClick: vi.fn(),
    onTaskClick: vi.fn(),
  };

  it("renders the date number", () => {
    render(<CalendarDay {...defaultProps} />);
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("renders task pills", () => {
    render(<CalendarDay {...defaultProps} tasks={mockTasks.slice(0, 2)} />);
    expect(screen.getByText("Task one")).toBeInTheDocument();
    expect(screen.getByText("Task two")).toBeInTheDocument();
  });

  it("shows overflow indicator when more than 3 tasks", () => {
    render(<CalendarDay {...defaultProps} tasks={mockTasks} />);
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    // 4th task should not be visible
    expect(screen.queryByText("Task four overflow")).not.toBeInTheDocument();
  });

  it("shows recurrence indicator on recurring tasks", () => {
    const recurringTask: Task = {
      ...mockTasks[0],
      recurrence: { frequency: "weekly", interval: 1 },
    };
    render(<CalendarDay {...defaultProps} tasks={[recurringTask]} />);
    expect(screen.getByText("↻")).toBeInTheDocument();
  });

  it("calls onDateClick when date button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onDateClick = vi.fn();
    render(<CalendarDay {...defaultProps} onDateClick={onDateClick} />);

    await user.click(screen.getByText("15"));
    expect(onDateClick).toHaveBeenCalledWith(new Date(2026, 1, 15));
  });

  it("calls onTaskClick when task pill is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onTaskClick = vi.fn();
    render(
      <CalendarDay
        {...defaultProps}
        tasks={mockTasks.slice(0, 1)}
        onTaskClick={onTaskClick}
      />,
    );

    await user.click(screen.getByText("Task one"));
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });
});
