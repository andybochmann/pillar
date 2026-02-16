import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./notification-bell";
import type { Notification } from "@/types";

// Mock useNotifications hook
const mockFetchNotifications = vi.fn();
const mockMarkAsRead = vi.fn();
const mockMarkAsDismissed = vi.fn();
const mockDismissAll = vi.fn();
const mockSnoozeNotification = vi.fn();
let mockNotifications: Notification[] = [];

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    fetchNotifications: mockFetchNotifications,
    loading: false,
    error: null,
    setNotifications: vi.fn(),
    markAsRead: mockMarkAsRead,
    markAsDismissed: mockMarkAsDismissed,
    dismissAll: mockDismissAll,
    snoozeNotification: mockSnoozeNotification,
    deleteNotification: vi.fn(),
  }),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifications.length = 0;
  });

  it("renders bell icon button", () => {
    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications" })
    ).toBeInTheDocument();
  });

  it("fetches notifications on mount", () => {
    render(<NotificationBell />);
    expect(mockFetchNotifications).toHaveBeenCalledWith({
      read: false,
      dismissed: false,
      limit: 10,
    });
  });

  it("does not show badge when no unread notifications", () => {
    render(<NotificationBell />);
    expect(
      screen.queryByLabelText(/unread notifications/i)
    ).not.toBeInTheDocument();
  });

  it("shows unread count badge when there are unread notifications", () => {
    mockNotifications.push(
      {
        _id: "1",
        userId: "user1",
        taskId: "task1",
        type: "reminder",
        title: "Task due soon",
        message: "Your task is due in 1 hour",
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: "2",
        userId: "user1",
        taskId: "task2",
        type: "overdue",
        title: "Task overdue",
        message: "Your task is overdue",
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "2 unread notifications" })
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows 99+ when count exceeds 99", () => {
    const notifications = Array.from({ length: 100 }, (_, i) => ({
      _id: `${i + 1}`,
      userId: "user1",
      taskId: `task${i + 1}`,
      type: "reminder" as const,
      title: `Notification ${i + 1}`,
      message: "Test message",
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    mockNotifications.push(...notifications);

    render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("excludes read notifications from count", () => {
    mockNotifications.push(
      {
        _id: "1",
        userId: "user1",
        taskId: "task1",
        type: "reminder",
        title: "Unread notification",
        message: "Test",
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: "2",
        userId: "user1",
        taskId: "task2",
        type: "overdue",
        title: "Read notification",
        message: "Test",
        read: true,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    render(<NotificationBell />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("excludes dismissed notifications from count", () => {
    mockNotifications.push(
      {
        _id: "1",
        userId: "user1",
        taskId: "task1",
        type: "reminder",
        title: "Active notification",
        message: "Test",
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: "2",
        userId: "user1",
        taskId: "task2",
        type: "overdue",
        title: "Dismissed notification",
        message: "Test",
        read: false,
        dismissed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    render(<NotificationBell />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("opens popover when bell is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("displays notification list when notifications exist", async () => {
    const user = userEvent.setup();
    mockNotifications.push({
      _id: "1",
      userId: "user1",
      taskId: "task1",
      type: "reminder",
      title: "Task due soon",
      message: "Your task is due in 1 hour",
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "1 unread notifications" }));

    expect(screen.getByText("Task due soon")).toBeInTheDocument();
    expect(screen.getByText("Your task is due in 1 hour")).toBeInTheDocument();
  });

  it("limits displayed notifications to 5", async () => {
    const user = userEvent.setup();
    const notifications = Array.from({ length: 10 }, (_, i) => ({
      _id: `${i + 1}`,
      userId: "user1",
      taskId: `task${i + 1}`,
      type: "reminder" as const,
      title: `Notification ${i + 1}`,
      message: "Test message",
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    mockNotifications.push(...notifications);

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "10 unread notifications" }));

    expect(screen.getByText("Notification 1")).toBeInTheDocument();
    expect(screen.getByText("Notification 5")).toBeInTheDocument();
    expect(screen.queryByText("Notification 6")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <NotificationBell className="custom-class" />
    );
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("applies custom icon size", () => {
    render(<NotificationBell iconSize={24} />);
    const button = screen.getByRole("button", { name: "Notifications" });
    const icon = button.querySelector("svg");
    expect(icon).toHaveStyle({ "--icon-size": "24px" });
  });

  it("shows clear all button when notifications exist", async () => {
    const user = userEvent.setup();
    mockNotifications.push({
      _id: "1",
      userId: "user1",
      taskId: "task1",
      type: "reminder",
      title: "Task due soon",
      message: "Your task is due in 1 hour",
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "1 unread notifications" }));

    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });

  it("does not show clear all button when no active notifications", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("calls dismissAll when clear all is clicked", async () => {
    const user = userEvent.setup();
    mockDismissAll.mockResolvedValue(undefined);
    mockNotifications.push({
      _id: "1",
      userId: "user1",
      taskId: "task1",
      type: "reminder",
      title: "Task due soon",
      message: "Test",
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "1 unread notifications" }));
    await user.click(screen.getByRole("button", { name: /clear all/i }));

    await waitFor(() => {
      expect(mockDismissAll).toHaveBeenCalledTimes(1);
    });
  });

  it("shows mark all read button when unread notifications exist", async () => {
    const user = userEvent.setup();
    mockNotifications.push({
      _id: "1",
      userId: "user1",
      taskId: "task1",
      type: "reminder",
      title: "Task due soon",
      message: "Test",
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "1 unread notifications" }));

    expect(screen.getByRole("button", { name: /mark all read/i })).toBeInTheDocument();
  });

  it("does not show mark all read button when all are read", async () => {
    const user = userEvent.setup();
    mockNotifications.push({
      _id: "1",
      userId: "user1",
      taskId: "task1",
      type: "reminder",
      title: "Task due soon",
      message: "Test",
      read: true,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.queryByRole("button", { name: /mark all read/i })).not.toBeInTheDocument();
  });

  it("calls markAsRead for all unread when mark all read is clicked", async () => {
    const user = userEvent.setup();
    mockMarkAsRead.mockResolvedValue({});
    mockNotifications.push(
      {
        _id: "1",
        userId: "user1",
        taskId: "task1",
        type: "reminder",
        title: "Notification 1",
        message: "Test",
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: "2",
        userId: "user1",
        taskId: "task2",
        type: "overdue",
        title: "Notification 2",
        message: "Test",
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "2 unread notifications" }));
    await user.click(screen.getByRole("button", { name: /mark all read/i }));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith("1");
      expect(mockMarkAsRead).toHaveBeenCalledWith("2");
    });
  });

  it("renders per-item action buttons on hover", async () => {
    const user = userEvent.setup();
    mockNotifications.push({
      _id: "1",
      userId: "user1",
      taskId: "task1",
      type: "reminder",
      title: "Task due soon",
      message: "Test",
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "1 unread notifications" }));

    // NotificationItem renders mark as read, snooze, and dismiss buttons
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snooze notification" })).toBeInTheDocument();
  });
});
