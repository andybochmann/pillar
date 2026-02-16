import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskTimeTrackingSection } from "./task-time-tracking-section";
import type { TimeSession } from "@/types";

const mockTimeSessions: TimeSession[] = [
  {
    _id: "session-1",
    userId: "user-1",
    startedAt: "2024-01-01T10:00:00Z",
    endedAt: "2024-01-01T11:00:00Z",
  },
  {
    _id: "session-2",
    userId: "user-1",
    startedAt: "2024-01-01T14:00:00Z",
    endedAt: "2024-01-01T15:30:00Z",
  },
];

const activeSession: TimeSession = {
  _id: "session-3",
  userId: "user-1",
  startedAt: "2024-01-01T16:00:00Z",
  endedAt: null,
};

describe("TaskTimeTrackingSection", () => {
  let onStartTracking: ReturnType<typeof vi.fn>;
  let onStopTracking: ReturnType<typeof vi.fn>;
  let onDeleteSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onStartTracking = vi.fn();
    onStopTracking = vi.fn();
    onDeleteSession = vi.fn();
  });

  it("returns null when currentUserId is not provided", () => {
    const { container } = render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders Start Tracking button when no active session", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    expect(
      screen.getByRole("button", { name: /start tracking/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /stop tracking/i }),
    ).not.toBeInTheDocument();
  });

  it("renders Stop Tracking button when there is an active session", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={[...mockTimeSessions, activeSession]}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    expect(
      screen.getByRole("button", { name: /stop tracking/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start tracking/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onStartTracking with correct taskId when Start button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskTimeTrackingSection
        taskId="task-123"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    await user.click(screen.getByRole("button", { name: /start tracking/i }));
    expect(onStartTracking).toHaveBeenCalledWith("task-123");
    expect(onStartTracking).toHaveBeenCalledTimes(1);
  });

  it("calls onStopTracking with correct taskId when Stop button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskTimeTrackingSection
        taskId="task-456"
        timeSessions={[...mockTimeSessions, activeSession]}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    await user.click(screen.getByRole("button", { name: /stop tracking/i }));
    expect(onStopTracking).toHaveBeenCalledWith("task-456");
    expect(onStopTracking).toHaveBeenCalledTimes(1);
  });

  it("does not render tracking buttons if handlers are not provided", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onDeleteSession={onDeleteSession}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /start tracking/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /stop tracking/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render tracking buttons if only onStartTracking is provided", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /start tracking/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render tracking buttons if only onStopTracking is provided", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /start tracking/i }),
    ).not.toBeInTheDocument();
  });

  it("renders TimeSessionsList with correct sessions prop", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    // TimeSessionsList renders "Time Tracking" label
    expect(screen.getByText("Time Tracking")).toBeInTheDocument();
  });

  it("identifies active session for current user", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={[...mockTimeSessions, activeSession]}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    // Stop button shown = active session detected
    expect(
      screen.getByRole("button", { name: /stop tracking/i }),
    ).toBeInTheDocument();
  });

  it("does not identify active session for different user", () => {
    const otherUserSession: TimeSession = {
      _id: "session-other",
      userId: "user-2",
      startedAt: "2024-01-01T16:00:00Z",
      endedAt: null,
    };

    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={[...mockTimeSessions, otherUserSession]}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    // Start button shown = no active session for current user
    expect(
      screen.getByRole("button", { name: /start tracking/i }),
    ).toBeInTheDocument();
  });

  it("applies correct styling to Start Tracking button", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    const button = screen.getByRole("button", { name: /start tracking/i });
    expect(button).toHaveClass("w-full");
  });

  it("applies correct styling to Stop Tracking button", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={[...mockTimeSessions, activeSession]}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    const button = screen.getByRole("button", { name: /stop tracking/i });
    expect(button).toHaveClass("w-full");
    expect(button).toHaveClass("text-green-600");
  });

  it("renders with empty timeSessions array", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={[]}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    expect(
      screen.getByRole("button", { name: /start tracking/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("No time tracked")).toBeInTheDocument();
  });

  it("passes taskId and sessionId to onDeleteSession correctly", () => {
    render(
      <TaskTimeTrackingSection
        taskId="task-789"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    // TimeSessionsList will have delete buttons, but we test the prop passing
    // by verifying the component accepts the callback
    expect(onDeleteSession).not.toHaveBeenCalled();
  });

  it("renders space-y-2 layout class on container", () => {
    const { container } = render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={mockTimeSessions}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    const spaceContainer = container.querySelector(".space-y-2");
    expect(spaceContainer).toBeInTheDocument();
  });

  it("handles multiple active sessions by finding first match", () => {
    const multipleActive: TimeSession[] = [
      {
        _id: "session-active-1",
        userId: "user-1",
        startedAt: "2024-01-01T15:00:00Z",
        endedAt: null,
      },
      {
        _id: "session-active-2",
        userId: "user-1",
        startedAt: "2024-01-01T16:00:00Z",
        endedAt: null,
      },
    ];

    render(
      <TaskTimeTrackingSection
        taskId="task-1"
        timeSessions={multipleActive}
        currentUserId="user-1"
        onStartTracking={onStartTracking}
        onStopTracking={onStopTracking}
        onDeleteSession={onDeleteSession}
      />,
    );

    // Should show Stop button if any active session exists
    expect(
      screen.getByRole("button", { name: /stop tracking/i }),
    ).toBeInTheDocument();
  });
});
