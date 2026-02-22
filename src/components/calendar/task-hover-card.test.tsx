import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TaskHoverCard } from "./task-hover-card";
import type { Task, Label } from "@/types";

// Mock radix-ui HoverCard to make it easier to test
vi.mock("radix-ui", async () => {
  const actual = await vi.importActual<typeof import("radix-ui")>("radix-ui");
  return {
    ...actual,
    HoverCard: {
      Root: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-root">{children}</div>,
      Trigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <div data-testid="hover-card-trigger">{children}</div>,
      Portal: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-portal">{children}</div>,
      Content: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="hover-card-content" className={className}>{children}</div>
      ),
    },
  };
});

const mockTask: Task = {
  _id: "task-1",
  title: "Test Task",
  description: "This is a test task description",
  projectId: "project-1",
  userId: "user-1",
  columnId: "todo",
  priority: "high",
  dueDate: "2026-03-15T12:00:00.000Z",
  order: 0,
  labels: ["label-1", "label-2"],
  subtasks: [],
  timeSessions: [],
  statusHistory: [],
  archived: false,
  createdAt: "2026-02-15T00:00:00.000Z",
  updatedAt: "2026-02-15T00:00:00.000Z",
};

const mockLabels: Label[] = [
  {
    _id: "label-1",
    name: "Bug",
    color: "#ef4444",
    userId: "user-1",
    createdAt: "2026-02-15T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z",
  },
  {
    _id: "label-2",
    name: "Feature",
    color: "#3b82f6",
    userId: "user-1",
    createdAt: "2026-02-15T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z",
  },
  {
    _id: "label-3",
    name: "Unused",
    color: "#22c55e",
    userId: "user-1",
    createdAt: "2026-02-15T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TaskHoverCard", () => {
  it("shows task title", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("shows task description when present", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(
      screen.getByText("This is a test task description"),
    ).toBeInTheDocument();
  });

  it("does not show description when absent", () => {
    const taskWithoutDesc = { ...mockTask, description: undefined };
    render(
      <TaskHoverCard task={taskWithoutDesc} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText("Test Task")).toBeInTheDocument();
    // Description paragraph should not exist
    expect(screen.queryByText(/test task description/i)).not.toBeInTheDocument();
  });

  it("shows priority badge with correct label", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows all priority levels correctly", () => {
    const priorities: Array<{ priority: Task["priority"]; label: string }> = [
      { priority: "urgent", label: "Urgent" },
      { priority: "high", label: "High" },
      { priority: "medium", label: "Medium" },
      { priority: "low", label: "Low" },
    ];

    priorities.forEach(({ priority, label }) => {
      const { unmount } = render(
        <TaskHoverCard task={{ ...mockTask, priority }} labels={mockLabels}>
          <button>Hover me</button>
        </TaskHoverCard>,
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it("shows due date when present", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText(/Due: Mar 15, 2026/)).toBeInTheDocument();
  });

  it("does not show due date when absent", () => {
    const taskWithoutDueDate = { ...mockTask, dueDate: undefined };
    render(
      <TaskHoverCard task={taskWithoutDueDate} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
  });

  it("shows task labels", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();
  });

  it("does not show labels not assigned to task", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.queryByText("Unused")).not.toBeInTheDocument();
  });

  it("does not show label section when task has no labels", () => {
    const taskWithoutLabels = { ...mockTask, labels: [] };
    render(
      <TaskHoverCard task={taskWithoutLabels} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    // Labels should not appear
    expect(screen.queryByText("Bug")).not.toBeInTheDocument();
    expect(screen.queryByText("Feature")).not.toBeInTheDocument();
  });

  it("renders children as trigger", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("works without labels prop", () => {
    render(
      <TaskHoverCard task={mockTask}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText("Test Task")).toBeInTheDocument();
    // Labels from task should not appear since no labels array provided
    expect(screen.queryByText("Bug")).not.toBeInTheDocument();
  });

  it("handles empty labels array", () => {
    render(
      <TaskHoverCard task={mockTask} labels={[]}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    expect(screen.getByText("Test Task")).toBeInTheDocument();
    expect(screen.queryByText("Bug")).not.toBeInTheDocument();
  });

  it("shows complete task information", () => {
    render(
      <TaskHoverCard task={mockTask} labels={mockLabels}>
        <button>Hover me</button>
      </TaskHoverCard>,
    );

    // Title
    expect(screen.getByText("Test Task")).toBeInTheDocument();
    // Description
    expect(
      screen.getByText("This is a test task description"),
    ).toBeInTheDocument();
    // Priority
    expect(screen.getByText("High")).toBeInTheDocument();
    // Due date
    expect(screen.getByText(/Due: Mar 15, 2026/)).toBeInTheDocument();
    // Labels
    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();
  });
});
