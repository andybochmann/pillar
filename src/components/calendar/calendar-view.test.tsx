import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarView } from "./calendar-view";
import type { Task } from "@/types";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock @dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockTasks: Task[] = [
  {
    _id: "task-1",
    title: "Calendar task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "high",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 0,
    labels: [],
    timeSessions: [],
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CalendarView", () => {
  const defaultProps = {
    tasks: mockTasks,
    currentMonth: new Date(2026, 1, 1), // February 2026
    onTaskClick: vi.fn(),
    onDateClick: vi.fn(),
    onTaskReschedule: vi.fn().mockResolvedValue(undefined),
  };

  it("renders month and year heading", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText("February 2026")).toBeInTheDocument();
  });

  it("renders weekday headers", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });

  it("renders day numbers for the month", () => {
    render(<CalendarView {...defaultProps} />);
    // February 2026 has 28 days
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("renders task pill on the correct date", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByText("Calendar task")).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<CalendarView {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Previous month" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next month" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("navigates to previous month", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-01"),
    );
  });

  it("navigates to next month", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-03"),
    );
  });

  it("navigates to today when Today button clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(mockPush).toHaveBeenCalledWith("/calendar?");
  });

  it("renders with no tasks (empty calendar)", () => {
    render(<CalendarView {...defaultProps} tasks={[]} />);
    expect(screen.getByText("February 2026")).toBeInTheDocument();
    expect(screen.queryByText("Calendar task")).not.toBeInTheDocument();
  });
});
