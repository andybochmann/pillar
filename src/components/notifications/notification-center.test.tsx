import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationCenter } from "./notification-center";
import type { Notification } from "@/types";

// Mock useNotifications hook
const mockFetchNotifications = vi.fn();
const mockMarkAsRead = vi.fn();
const mockMarkAsDismissed = vi.fn();
const mockSnoozeNotification = vi.fn();
const mockDeleteNotification = vi.fn();
let mockNotifications: Notification[] = [];
let mockLoading = false;
let mockError: string | null = null;

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    loading: mockLoading,
    error: mockError,
    setNotifications: vi.fn(),
    fetchNotifications: mockFetchNotifications,
    markAsRead: mockMarkAsRead,
    markAsDismissed: mockMarkAsDismissed,
    snoozeNotification: mockSnoozeNotification,
    deleteNotification: mockDeleteNotification,
  }),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NotificationCenter", () => {
  const baseNotification: Notification = {
    _id: "notif-1",
    userId: "user-1",
    taskId: "task-1",
    type: "due-soon",
    title: "Task due soon",
    message: "Your task is due in 1 hour",
    read: false,
    dismissed: false,
    createdAt: new Date("2026-02-15T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-02-15T10:00:00Z").toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifications = [];
    mockLoading = false;
    mockError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders notification center heading", () => {
    render(<NotificationCenter />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("fetches notifications on mount", () => {
    render(<NotificationCenter />);
    expect(mockFetchNotifications).toHaveBeenCalled();
  });

  it("renders all tab by default", () => {
    render(<NotificationCenter />);
    expect(screen.getByRole("tab", { name: /all/i, selected: true })).toBeInTheDocument();
  });

  it("renders unread and read tabs", () => {
    render(<NotificationCenter />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[1]).toHaveAccessibleName("Unread");
    expect(tabs[2]).toHaveAccessibleName("Read");
  });

  it("shows empty state when no notifications", () => {
    render(<NotificationCenter />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockLoading = true;
    render(<NotificationCenter />);
    expect(screen.getByText("Loading notifications...")).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    mockError = "Failed to load notifications";
    render(<NotificationCenter />);
    expect(screen.getByText("Failed to load notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retries fetching notifications on retry button click", async () => {
    const user = userEvent.setup();
    mockError = "Failed to load notifications";
    render(<NotificationCenter />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(mockFetchNotifications).toHaveBeenCalledTimes(2); // Once on mount, once on retry
  });

  it("displays notifications list", () => {
    mockNotifications.push(baseNotification);
    render(<NotificationCenter />);
    expect(screen.getByText("Task due soon")).toBeInTheDocument();
    expect(screen.getByText("Your task is due in 1 hour")).toBeInTheDocument();
  });

  it("displays multiple notifications", () => {
    mockNotifications.push(
      baseNotification,
      {
        ...baseNotification,
        _id: "notif-2",
        title: "Another notification",
        message: "Another message",
      }
    );
    render(<NotificationCenter />);
    expect(screen.getByText("Task due soon")).toBeInTheDocument();
    expect(screen.getByText("Another notification")).toBeInTheDocument();
  });

  it("shows mark all as read button when there are unread notifications", () => {
    mockNotifications.push(baseNotification);
    render(<NotificationCenter />);
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument();
  });

  it("does not show mark all as read button when no unread notifications", () => {
    mockNotifications.push({ ...baseNotification, read: true });
    render(<NotificationCenter />);
    expect(screen.queryByRole("button", { name: /mark all as read/i })).not.toBeInTheDocument();
  });

  it("marks all notifications as read when button is clicked", async () => {
    const user = userEvent.setup();
    mockMarkAsRead.mockResolvedValue({});
    mockNotifications.push(
      baseNotification,
      { ...baseNotification, _id: "notif-2" }
    );
    render(<NotificationCenter />);

    await user.click(screen.getByRole("button", { name: /mark all as read/i }));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledTimes(2);
      expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
      expect(mockMarkAsRead).toHaveBeenCalledWith("notif-2");
    });
  });

  it("filters to unread notifications when unread tab is clicked", async () => {
    const user = userEvent.setup();
    mockNotifications.push(
      baseNotification,
      { ...baseNotification, _id: "notif-2", read: true }
    );
    render(<NotificationCenter />);

    await user.click(screen.getByRole("tab", { name: /unread/i }));

    expect(screen.getByText("Task due soon")).toBeInTheDocument();
    expect(screen.queryByText("Another notification")).not.toBeInTheDocument();
  });

  it("filters to read notifications when read tab is clicked", async () => {
    const user = userEvent.setup();
    mockNotifications.push(
      baseNotification,
      {
        ...baseNotification,
        _id: "notif-2",
        title: "Read notification",
        read: true,
      }
    );
    render(<NotificationCenter />);

    const tabs = screen.getAllByRole("tab");
    await user.click(tabs[2]); // Read tab is the third one

    expect(screen.getByText("Read notification")).toBeInTheDocument();
    expect(screen.queryByText("Task due soon")).not.toBeInTheDocument();
  });

  it("shows empty state for unread tab when no unread notifications", async () => {
    const user = userEvent.setup();
    mockNotifications.push({ ...baseNotification, read: true });
    render(<NotificationCenter />);

    await user.click(screen.getByRole("tab", { name: /unread/i }));

    expect(screen.getByText("No unread notifications")).toBeInTheDocument();
  });

  it("shows empty state for read tab when no read notifications", async () => {
    const user = userEvent.setup();
    mockNotifications.push(baseNotification);
    render(<NotificationCenter />);

    const tabs = screen.getAllByRole("tab");
    await user.click(tabs[2]); // Read tab is the third one

    expect(screen.getByText("No read notifications")).toBeInTheDocument();
  });

  it("displays notification count in all tab", () => {
    mockNotifications.push(baseNotification, {
      ...baseNotification,
      _id: "notif-2",
    });
    render(<NotificationCenter />);
    const allTab = screen.getByRole("tab", { name: /all/i });
    expect(allTab.textContent).toContain("(2)");
  });

  it("displays unread count in unread tab", () => {
    mockNotifications.push(
      baseNotification,
      { ...baseNotification, _id: "notif-2" },
      { ...baseNotification, _id: "notif-3", read: true }
    );
    render(<NotificationCenter />);
    const unreadTab = screen.getByRole("tab", { name: /unread/i });
    expect(unreadTab.textContent).toContain("(2)");
  });

  it("excludes dismissed notifications from all tab", async () => {
    const user = userEvent.setup();
    mockNotifications.push(
      baseNotification,
      { ...baseNotification, _id: "notif-2", dismissed: true }
    );
    render(<NotificationCenter />);

    expect(screen.getByText("Task due soon")).toBeInTheDocument();
    expect(screen.queryByText("Another notification")).not.toBeInTheDocument();
  });

  it("excludes dismissed notifications from count", () => {
    mockNotifications.push(
      baseNotification,
      { ...baseNotification, _id: "notif-2", dismissed: true }
    );
    render(<NotificationCenter />);
    const allTab = screen.getByRole("tab", { name: /all/i });
    expect(allTab.textContent).toContain("(1)");
  });

  it("calls onNotificationClick when notification is clicked", async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();
    mockMarkAsRead.mockResolvedValue({});
    mockNotifications.push(baseNotification);
    render(<NotificationCenter onNotificationClick={mockOnClick} />);

    await user.click(screen.getByRole("button", { name: /task due soon/i }));

    await waitFor(() => {
      expect(mockOnClick).toHaveBeenCalledWith(baseNotification);
    });
  });

  it("marks notification as read when clicked if unread", async () => {
    const user = userEvent.setup();
    mockMarkAsRead.mockResolvedValue({});
    mockNotifications.push(baseNotification);
    render(<NotificationCenter />);

    await user.click(screen.getByRole("button", { name: /task due soon/i }));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
    });
  });

  it("does not mark notification as read when clicked if already read", async () => {
    const user = userEvent.setup();
    mockNotifications.push({ ...baseNotification, read: true });
    render(<NotificationCenter />);

    await user.click(screen.getByRole("button", { name: /task due soon/i }));

    await waitFor(() => {
      expect(mockMarkAsRead).not.toHaveBeenCalled();
    });
  });

  it("calls markAsRead when mark as read button is clicked", async () => {
    const user = userEvent.setup();
    mockMarkAsRead.mockResolvedValue({});
    mockNotifications.push(baseNotification);
    render(<NotificationCenter />);

    await user.click(screen.getByRole("button", { name: /mark as read/i }));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
    });
  });

  it("calls markAsDismissed when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    mockMarkAsDismissed.mockResolvedValue({});
    mockNotifications.push(baseNotification);
    render(<NotificationCenter />);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    await waitFor(() => {
      expect(mockMarkAsDismissed).toHaveBeenCalledWith("notif-1");
    });
  });

  it("calls snoozeNotification with 1 hour when snooze button is clicked", async () => {
    const user = userEvent.setup();
    const now = new Date("2026-02-15T12:00:00Z");
    vi.setSystemTime(now);
    mockSnoozeNotification.mockResolvedValue({});
    mockNotifications.push(baseNotification);
    render(<NotificationCenter />);

    await user.click(screen.getByRole("button", { name: /snooze/i }));

    await waitFor(() => {
      expect(mockSnoozeNotification).toHaveBeenCalledWith(
        "notif-1",
        new Date("2026-02-15T13:00:00Z").toISOString()
      );
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <NotificationCenter className="custom-class" />
    );
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("accepts initial notifications prop", () => {
    const initialNotifications = [baseNotification];
    // The mock will be used, but the component should accept the prop
    mockNotifications.push(baseNotification);
    render(<NotificationCenter initialNotifications={initialNotifications} />);
    expect(screen.getByText("Task due soon")).toBeInTheDocument();
  });

  it("includes dismissed notifications in read tab", async () => {
    const user = userEvent.setup();
    mockNotifications.push(
      { ...baseNotification, read: true },
      {
        ...baseNotification,
        _id: "notif-2",
        title: "Dismissed notification",
        dismissed: true,
      }
    );
    render(<NotificationCenter />);

    const tabs = screen.getAllByRole("tab");
    await user.click(tabs[2]); // Read tab is the third one

    expect(screen.getByText("Task due soon")).toBeInTheDocument();
    expect(screen.getByText("Dismissed notification")).toBeInTheDocument();
  });

  it("shows Inbox icon in empty state", () => {
    render(<NotificationCenter />);
    const icon = document.querySelector(".lucide-inbox");
    expect(icon).toBeInTheDocument();
  });
});
