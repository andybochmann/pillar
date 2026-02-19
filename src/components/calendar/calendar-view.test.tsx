import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarView } from "./calendar-view";
import { EMPTY_FILTERS } from "./calendar-filter-bar";
import type { Task, Project, Label } from "@/types";

// Mock next/navigation with configurable searchParams
const mockPush = vi.fn();
const mockSearchParams = vi.hoisted(() => ({
  current: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams.current,
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
  mockSearchParams.current = new URLSearchParams();
});

describe("CalendarView", () => {
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
    currentMonth: new Date(2026, 1, 1), // February 2026
    viewType: "month" as const,
    filters: EMPTY_FILTERS,
    projects: mockProjects,
    assignees: [],
    onViewTypeChange: vi.fn(),
    onFiltersChange: vi.fn(),
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

  it("renders view toggle component", () => {
    render(<CalendarView {...defaultProps} />);
    expect(screen.getByTestId("calendar-view-toggle")).toBeInTheDocument();
  });

  it("navigates next based on URL month when prop is stale", async () => {
    // Simulate: URL says March (after a previous navigation) but prop is still February (stale)
    mockSearchParams.current = new URLSearchParams("month=2026-03");
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <CalendarView {...defaultProps} currentMonth={new Date(2026, 1, 1)} />,
    );

    await user.click(screen.getByRole("button", { name: "Next month" }));
    // Should navigate to April (March + 1), not March (stale Feb + 1)
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-04"),
    );
  });

  it("navigates prev based on URL month when prop is stale", async () => {
    // Simulate: URL says March but prop is still February (stale)
    mockSearchParams.current = new URLSearchParams("month=2026-03");
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <CalendarView {...defaultProps} currentMonth={new Date(2026, 1, 1)} />,
    );

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    // Should navigate to February (March - 1), not January (stale Feb - 1)
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-02"),
    );
  });

  it("navigates correctly when URL has yyyy-MM-dd format from week/day view", async () => {
    // Simulate: user was in week view (yyyy-MM-dd) and switched to month view
    mockSearchParams.current = new URLSearchParams("month=2026-03-15");
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <CalendarView {...defaultProps} currentMonth={new Date(2026, 1, 1)} />,
    );

    await user.click(screen.getByRole("button", { name: "Next month" }));
    // Should navigate to April (March + 1), parsing the full date correctly
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("month=2026-04"),
    );
  });
});
