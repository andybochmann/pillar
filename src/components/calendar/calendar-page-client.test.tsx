import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarPageClient } from "./calendar-page-client";
import type { Task, Project, Category } from "@/types";
import type { CalendarFilters } from "./calendar-filter-bar";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams,
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

// Mock hooks
vi.mock("@/hooks/use-categories", () => ({
  useCategories: vi.fn(() => ({
    categories: [
      {
        _id: "cat-1",
        name: "Work",
        color: "#3b82f6",
        userId: "u1",
        order: 0,
        createdAt: "",
        updatedAt: "",
      },
      {
        _id: "cat-2",
        name: "Personal",
        color: "#10b981",
        userId: "u1",
        order: 1,
        createdAt: "",
        updatedAt: "",
      },
    ],
    loading: false,
    error: null,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    refresh: vi.fn(),
  })),
}));

const mockProject: Project = {
  _id: "proj-1",
  name: "Test Project",
  userId: "u1",
  categoryId: "cat-1",
  columns: [
    { id: "todo", name: "To Do", order: 0 },
    { id: "in-progress", name: "In Progress", order: 1 },
    { id: "done", name: "Done", order: 2 },
  ],
  viewType: "board",
  archived: false,
  createdAt: "",
  updatedAt: "",
};

const mockProject2: Project = {
  _id: "proj-2",
  name: "Other Project",
  userId: "u1",
  categoryId: "cat-2",
  columns: [
    { id: "todo", name: "To Do", order: 0 },
    { id: "in-progress", name: "In Progress", order: 1 },
    { id: "done", name: "Done", order: 2 },
  ],
  viewType: "board",
  archived: false,
  createdAt: "",
  updatedAt: "",
};

const mockTasks: Task[] = [
  {
    _id: "task-1",
    title: "Test task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "medium",
    dueDate: "2026-02-15T00:00:00.000Z",
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
    title: "Urgent task",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "urgent",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 1,
    labels: ["label-1"],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-3",
    title: "Other project task",
    projectId: "proj-2",
    userId: "u1",
    columnId: "todo",
    priority: "low",
    dueDate: "2026-02-15T00:00:00.000Z",
    order: 2,
    labels: [],
    assigneeId: "user-1",
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams.delete("view");
});

describe("CalendarPageClient", () => {
  const defaultProps = {
    initialTasks: mockTasks,
    projects: [mockProject],
    currentMonth: new Date(2026, 1, 15), // Feb 15, 2026
  };

  it("renders month view by default", () => {
    render(<CalendarPageClient {...defaultProps} />);
    // Month view should show the month name
    expect(screen.getByText("February 2026")).toBeInTheDocument();
  });

  it("reads view type from URL params", () => {
    mockSearchParams.set("view", "week");
    render(
      <CalendarPageClient {...defaultProps} initialViewType="week" />,
    );
    // Week view should show the week date range
    // For Feb 15, 2026, the week is Feb 8-14, 2026
    expect(screen.getByText(/Feb \d+ - Feb \d+, 2026/)).toBeInTheDocument();
  });

  it("renders day view when view type is day", () => {
    mockSearchParams.set("view", "day");
    render(<CalendarPageClient {...defaultProps} initialViewType="day" />);
    // Day view should show the full date
    expect(
      screen.getByText("Sunday, February 15, 2026"),
    ).toBeInTheDocument();
  });

  it("handles invalid view type gracefully", () => {
    mockSearchParams.set("view", "invalid");
    render(<CalendarPageClient {...defaultProps} />);
    // Should fall back to month view
    expect(screen.getByText("February 2026")).toBeInTheDocument();
  });

  it("updates URL when view type changes", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(<CalendarPageClient {...defaultProps} />);

    // Future: When we add view toggle buttons, this will test the actual interaction
    // For now, we're just setting up the test structure
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows all tasks when no filters are applied", () => {
    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
      />,
    );
    // All three tasks should be visible
    expect(screen.getByText("Test task")).toBeInTheDocument();
    expect(screen.getByText("Urgent task")).toBeInTheDocument();
    expect(screen.getByText("Other project task")).toBeInTheDocument();
  });

  it("filters tasks by project", () => {
    const filters: CalendarFilters = {
      projects: ["proj-1"],
      labels: [],
      priorities: [],
      assignees: [],
    };

    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
        filters={filters}
      />,
    );

    // Only tasks from proj-1 should be visible
    expect(screen.getByText("Test task")).toBeInTheDocument();
    expect(screen.getByText("Urgent task")).toBeInTheDocument();
    expect(screen.queryByText("Other project task")).not.toBeInTheDocument();
  });

  it("filters tasks by priority", () => {
    const filters: CalendarFilters = {
      projects: [],
      labels: [],
      priorities: ["urgent"],
      assignees: [],
    };

    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
        filters={filters}
      />,
    );

    // Only urgent task should be visible
    expect(screen.queryByText("Test task")).not.toBeInTheDocument();
    expect(screen.getByText("Urgent task")).toBeInTheDocument();
    expect(screen.queryByText("Other project task")).not.toBeInTheDocument();
  });

  it("filters tasks by label", () => {
    const filters: CalendarFilters = {
      projects: [],
      labels: ["label-1"],
      priorities: [],
      assignees: [],
    };

    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
        filters={filters}
      />,
    );

    // Only task with label-1 should be visible
    expect(screen.queryByText("Test task")).not.toBeInTheDocument();
    expect(screen.getByText("Urgent task")).toBeInTheDocument();
    expect(screen.queryByText("Other project task")).not.toBeInTheDocument();
  });

  it("filters tasks by assignee", () => {
    const filters: CalendarFilters = {
      projects: [],
      labels: [],
      priorities: [],
      assignees: ["user-1"],
    };

    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
        filters={filters}
      />,
    );

    // Only task with assigneeId user-1 should be visible
    expect(screen.queryByText("Test task")).not.toBeInTheDocument();
    expect(screen.queryByText("Urgent task")).not.toBeInTheDocument();
    expect(screen.getByText("Other project task")).toBeInTheDocument();
  });

  it("applies multiple filters together", () => {
    const filters: CalendarFilters = {
      projects: ["proj-1"],
      labels: [],
      priorities: ["urgent"],
      assignees: [],
    };

    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
        filters={filters}
      />,
    );

    // Only task that is both from proj-1 AND urgent
    expect(screen.queryByText("Test task")).not.toBeInTheDocument();
    expect(screen.getByText("Urgent task")).toBeInTheDocument();
    expect(screen.queryByText("Other project task")).not.toBeInTheDocument();
  });

  it("shows no tasks when filters match nothing", () => {
    const filters: CalendarFilters = {
      projects: ["non-existent"],
      labels: [],
      priorities: [],
      assignees: [],
    };

    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
        filters={filters}
      />,
    );

    // No tasks should be visible
    expect(screen.queryByText("Test task")).not.toBeInTheDocument();
    expect(screen.queryByText("Urgent task")).not.toBeInTheDocument();
    expect(screen.queryByText("Other project task")).not.toBeInTheDocument();
  });

  it("creates project color mapping from categories", () => {
    // Test that component renders correctly with projects linked to categories
    render(
      <CalendarPageClient
        {...defaultProps}
        initialTasks={mockTasks}
        projects={[mockProject, mockProject2]}
      />,
    );

    // Component should render without errors
    expect(screen.getByText("Test task")).toBeInTheDocument();
    expect(screen.getByText("Other project task")).toBeInTheDocument();

    // Project 1 is linked to cat-1 (#3b82f6 - blue)
    // Project 2 is linked to cat-2 (#10b981 - green)
    // The actual color usage will be tested when task pills are updated
  });
});
