import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "./kanban-board";
import type { Task, Column } from "@/types";
import type { BoardFilters } from "./board-filter-bar";

// --- Mocks ---

const mockStartTracking = vi.fn();
const mockStopTracking = vi.fn();
const mockUpdateTask = vi.fn();
const mockCreateTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockDuplicateTask = vi.fn();

vi.mock("@/hooks/use-time-tracking", () => ({
  useTimeTracking: () => ({
    startTracking: mockStartTracking,
    stopTracking: mockStopTracking,
    deleteSession: vi.fn(),
    activeTaskIds: new Set<string>(),
  }),
}));

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: (_initial: Task[], _projectId: string) => ({
    tasks: _initial,
    setTasks: vi.fn(),
    createTask: mockCreateTask,
    updateTask: mockUpdateTask,
    deleteTask: mockDeleteTask,
    duplicateTask: mockDuplicateTask,
    loading: false,
    error: null,
    fetchTasks: vi.fn(),
  }),
}));

// Mock @dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DragOverlay: () => null,
  closestCorners: vi.fn(),
  pointerWithin: vi.fn(),
  MouseSensor: vi.fn(),
  TouchSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  verticalListSortingStrategy: {},
  arrayMove: vi.fn(),
}));

// Mock child components — render minimal UI that exposes the onStartTracking callback
vi.mock("./kanban-column", () => ({
  KanbanColumn: ({
    column,
    tasks,
    onStartTracking,
  }: {
    column: { id: string; name: string };
    tasks: Task[];
    onStartTracking?: (taskId: string) => void;
  }) => (
    <div data-testid={`column-${column.id}`}>
      <span>{column.name}</span>
      {tasks.map((t) => (
        <div key={t._id} data-testid={`task-${t._id}`}>
          <span>{t.title}</span>
          {onStartTracking && (
            <button
              aria-label="start timer"
              onClick={() => onStartTracking(t._id)}
            >
              Play
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/tasks/task-sheet", () => ({
  TaskSheet: () => null,
}));

vi.mock("./bulk-actions-bar", () => ({
  BulkActionsBar: () => null,
}));

// Mock sonner toast
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: vi.fn(),
  },
}));

// --- Test data ---

const defaultColumns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "review", name: "Review", order: 2 },
  { id: "done", name: "Done", order: 3 },
];

const defaultFilters: BoardFilters = {
  priorities: [],
  labels: [],
  dueDateRange: null,
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    _id: "task-1",
    title: "Test task",
    projectId: "proj-1",
    userId: "user-1",
    columnId: "todo",
    priority: "medium",
    order: 0,
    labels: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("KanbanBoard — auto-move on timer start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves task from first column to second when timer starts", async () => {
    const task = makeTask({ columnId: "todo" });
    const movedTask = { ...task, columnId: "in-progress" };

    mockStartTracking.mockResolvedValue(task);
    mockUpdateTask.mockResolvedValue(movedTask);

    render(
      <KanbanBoard
        projectId="proj-1"
        columns={defaultColumns}
        initialTasks={[task]}
        filters={defaultFilters}
        allLabels={[]}
        onCreateLabel={vi.fn()}
        currentUserId="user-1"
      />,
    );

    const playButton = screen.getByRole("button", { name: /start timer/i });
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(mockStartTracking).toHaveBeenCalledWith("task-1");
    });

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith("task-1", {
        columnId: "in-progress",
      });
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Moved to In Progress");
    });
  });

  it("does NOT move task if already past the first column", async () => {
    const task = makeTask({ columnId: "in-progress" });

    mockStartTracking.mockResolvedValue(task);

    render(
      <KanbanBoard
        projectId="proj-1"
        columns={defaultColumns}
        initialTasks={[task]}
        filters={defaultFilters}
        allLabels={[]}
        onCreateLabel={vi.fn()}
        currentUserId="user-1"
      />,
    );

    const playButton = screen.getByRole("button", { name: /start timer/i });
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(mockStartTracking).toHaveBeenCalledWith("task-1");
    });

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("shows toast with correct column name on auto-move", async () => {
    const customColumns: Column[] = [
      { id: "backlog", name: "Backlog", order: 0 },
      { id: "wip", name: "Work In Progress", order: 1 },
      { id: "done", name: "Done", order: 2 },
    ];
    const task = makeTask({ columnId: "backlog" });
    const movedTask = { ...task, columnId: "wip" };

    mockStartTracking.mockResolvedValue(task);
    mockUpdateTask.mockResolvedValue(movedTask);

    render(
      <KanbanBoard
        projectId="proj-1"
        columns={customColumns}
        initialTasks={[task]}
        filters={defaultFilters}
        allLabels={[]}
        onCreateLabel={vi.fn()}
        currentUserId="user-1"
      />,
    );

    const playButton = screen.getByRole("button", { name: /start timer/i });
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Moved to Work In Progress",
      );
    });
  });
});
