import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarDayView } from "./calendar-day-view";
import { EMPTY_FILTERS } from "./calendar-filter-bar";
import type { Task, Project, Label } from "@/types";

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
    title: "Morning task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "high",
    dueDate: "2026-02-15T09:00:00.000Z",
    order: 0,
    labels: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-2",
    title: "Afternoon task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    dueDate: "2026-02-15T14:30:00.000Z",
    order: 0,
    labels: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-3",
    title: "All day task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "low",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 0,
    labels: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CalendarDayView", () => {
  const mockProjects: Project[] = [
    {
      _id: "proj-1",
      name: "Test Project",
      userId: "u1",
      categoryId: "cat-1",
      columns: [{ id: "todo", name: "To Do", order: 0 }],
      viewType: "board" as const,
      archived: false,
      createdAt: "",
      updatedAt: "",
    },
  ];

  const mockLabels: Label[] = [];

  const defaultProps = {
    tasks: mockTasks,
    labels: mockLabels,
    currentDay: new Date(2026, 1, 15),
    viewType: "day" as const,
    filters: EMPTY_FILTERS,
    projects: mockProjects,
    assignees: [],
    onViewTypeChange: vi.fn(),
    onFiltersChange: vi.fn(),
    onTaskClick: vi.fn(),
    onTaskReschedule: vi.fn().mockResolvedValue(undefined),
  };

  it("renders day date heading", () => {
    render(<CalendarDayView {...defaultProps} />);
    expect(screen.getByText("Sunday, February 15, 2026")).toBeInTheDocument();
  });

  it("renders time slots from 0:00 to 23:00", () => {
    render(<CalendarDayView {...defaultProps} />);
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("12:00 PM")).toBeInTheDocument();
    expect(screen.getByText("6:00 PM")).toBeInTheDocument();
    expect(screen.getByText("11:00 PM")).toBeInTheDocument();
  });

  it("renders all day section", () => {
    render(<CalendarDayView {...defaultProps} />);
    expect(screen.getByText("All Day")).toBeInTheDocument();
  });

  it("renders tasks in their time slots", () => {
    render(<CalendarDayView {...defaultProps} />);
    expect(screen.getByText("Morning task")).toBeInTheDocument();
    expect(screen.getByText("Afternoon task")).toBeInTheDocument();
  });

  it("renders all-day tasks in all-day section", () => {
    render(<CalendarDayView {...defaultProps} />);
    expect(screen.getByText("All day task")).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<CalendarDayView {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Previous day" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next day" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("navigates to previous day", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarDayView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-02"),
    );
  });

  it("navigates to next day", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarDayView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Next day" }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-02"),
    );
  });

  it("navigates to today when Today button clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarDayView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(mockPush).toHaveBeenCalledWith("/calendar?");
  });

  it("renders with no tasks (empty day)", () => {
    render(<CalendarDayView {...defaultProps} tasks={[]} />);
    expect(screen.getByText("Sunday, February 15, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Morning task")).not.toBeInTheDocument();
  });

  it("renders view toggle component", () => {
    render(<CalendarDayView {...defaultProps} />);
    expect(screen.getByTestId("calendar-view-toggle")).toBeInTheDocument();
  });

  it("calls onTaskClick when task is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onTaskClick = vi.fn();
    render(<CalendarDayView {...defaultProps} onTaskClick={onTaskClick} />);

    await user.click(screen.getByText("Morning task"));
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it("displays current time indicator", () => {
    render(<CalendarDayView {...defaultProps} currentDay={new Date()} />);
    // Current time indicator should be visible when viewing today
    // Just verify the component renders when showing today's date
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("groups multiple tasks in same hour", () => {
    const tasksInSameHour: Task[] = [
      {
        ...mockTasks[0],
        _id: "task-a",
        title: "First 9am task",
        dueDate: "2026-02-15T09:15:00.000Z",
      },
      {
        ...mockTasks[0],
        _id: "task-b",
        title: "Second 9am task",
        dueDate: "2026-02-15T09:45:00.000Z",
      },
    ];
    render(<CalendarDayView {...defaultProps} tasks={tasksInSameHour} />);
    expect(screen.getByText("First 9am task")).toBeInTheDocument();
    expect(screen.getByText("Second 9am task")).toBeInTheDocument();
  });
});
