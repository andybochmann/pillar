import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarWeekView } from "./calendar-week-view";
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
    title: "Week task Monday",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "high",
    dueDate: "2026-02-09T00:00:00.000Z", // Monday
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
    title: "Week task Wednesday",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    dueDate: "2026-02-11T00:00:00.000Z", // Wednesday
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

describe("CalendarWeekView", () => {
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
    currentWeek: new Date(2026, 1, 9), // Feb 9, 2026 (Monday)
    viewType: "week" as const,
    filters: EMPTY_FILTERS,
    projects: mockProjects,
    assignees: [],
    onViewTypeChange: vi.fn(),
    onFiltersChange: vi.fn(),
    onTaskClick: vi.fn(),
    onDateClick: vi.fn(),
    onTaskReschedule: vi.fn().mockResolvedValue(undefined),
  };

  it("renders week date range heading", () => {
    render(<CalendarWeekView {...defaultProps} />);
    // Week of Feb 8-14, 2026
    expect(screen.getByText(/Feb 8 - Feb 14, 2026/)).toBeInTheDocument();
  });

  it("renders all 7 weekday headers", () => {
    render(<CalendarWeekView {...defaultProps} />);
    expect(screen.getByText("Sunday")).toBeInTheDocument();
    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Tuesday")).toBeInTheDocument();
    expect(screen.getByText("Wednesday")).toBeInTheDocument();
    expect(screen.getByText("Thursday")).toBeInTheDocument();
    expect(screen.getByText("Friday")).toBeInTheDocument();
    expect(screen.getByText("Saturday")).toBeInTheDocument();
  });

  it("renders tasks grouped by day", () => {
    render(<CalendarWeekView {...defaultProps} />);
    expect(screen.getByText("Week task Monday")).toBeInTheDocument();
    expect(screen.getByText("Week task Wednesday")).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<CalendarWeekView {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Previous week" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next week" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("navigates to previous week", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarWeekView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-02"),
    );
  });

  it("navigates to next week", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarWeekView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-02"),
    );
  });

  it("navigates to today when Today button clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CalendarWeekView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(mockPush).toHaveBeenCalledWith("/calendar?");
  });

  it("renders with no tasks (empty week)", () => {
    render(<CalendarWeekView {...defaultProps} tasks={[]} />);
    expect(screen.getByText(/Feb 8 - Feb 14, 2026/)).toBeInTheDocument();
    expect(screen.queryByText("Week task Monday")).not.toBeInTheDocument();
    expect(screen.queryByText("Week task Wednesday")).not.toBeInTheDocument();
  });

  it("renders view toggle component", () => {
    render(<CalendarWeekView {...defaultProps} />);
    expect(screen.getByTestId("calendar-view-toggle")).toBeInTheDocument();
  });

  it("renders 7 day cells in the grid", () => {
    render(<CalendarWeekView {...defaultProps} />);
    // The week should contain dates 8, 9, 10, 11, 12, 13, 14
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });
});
