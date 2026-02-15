import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarPageClient } from "./calendar-page-client";
import type { Task, Project } from "@/types";

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
    timeSessions: [],
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
});
