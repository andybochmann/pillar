import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationItem } from "./notification-item";
import type { Notification } from "@/types";

describe("NotificationItem", () => {
  const mockOnClick = vi.fn();
  const mockOnMarkAsRead = vi.fn();
  const mockOnDismiss = vi.fn();
  const mockOnSnooze = vi.fn();

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
  });

  it("renders notification title and message", () => {
    render(<NotificationItem notification={baseNotification} />);
    expect(screen.getByText("Task due soon")).toBeInTheDocument();
    expect(screen.getByText("Your task is due in 1 hour")).toBeInTheDocument();
  });

  it("renders unread notification with distinct styling", () => {
    const { container } = render(
      <NotificationItem notification={baseNotification} />
    );
    const notificationElement = container.firstChild as HTMLElement;
    expect(notificationElement).toHaveClass("bg-background");
    expect(notificationElement).not.toHaveClass("bg-muted/50");
  });

  it("renders read notification with muted styling", () => {
    const readNotification = { ...baseNotification, read: true };
    const { container } = render(
      <NotificationItem notification={readNotification} />
    );
    const notificationElement = container.firstChild as HTMLElement;
    expect(notificationElement).toHaveClass("bg-muted/50");
    expect(notificationElement).toHaveClass("text-muted-foreground");
  });

  it("displays notification type badge", () => {
    render(<NotificationItem notification={baseNotification} />);
    expect(screen.getByText("Due Soon")).toBeInTheDocument();
  });

  it("displays correct badge for overdue type", () => {
    const overdueNotif = { ...baseNotification, type: "overdue" as const };
    render(<NotificationItem notification={overdueNotif} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("displays correct badge for reminder type", () => {
    const reminderNotif = { ...baseNotification, type: "reminder" as const };
    render(<NotificationItem notification={reminderNotif} />);
    expect(screen.getByText("Reminder")).toBeInTheDocument();
  });

  it("displays correct badge for daily-summary type", () => {
    const summaryNotif = {
      ...baseNotification,
      type: "daily-summary" as const,
    };
    render(<NotificationItem notification={summaryNotif} />);
    expect(screen.getByText("Daily Summary")).toBeInTheDocument();
  });

  it("calls onClick when notification is clicked", async () => {
    const user = userEvent.setup();
    render(
      <NotificationItem notification={baseNotification} onClick={mockOnClick} />
    );

    await user.click(screen.getByRole("button", { name: /task due soon/i }));
    expect(mockOnClick).toHaveBeenCalledWith("notif-1");
  });

  it("does not call onClick when actions are clicked", async () => {
    const user = userEvent.setup();
    render(
      <NotificationItem
        notification={baseNotification}
        onClick={mockOnClick}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const markAsReadButton = screen.getByRole("button", { name: /mark as read/i });
    await user.click(markAsReadButton);

    expect(mockOnMarkAsRead).toHaveBeenCalledWith("notif-1");
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("shows mark as read button for unread notifications", () => {
    render(
      <NotificationItem
        notification={baseNotification}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );
    expect(screen.getByRole("button", { name: /mark as read/i })).toBeInTheDocument();
  });

  it("does not show mark as read button for read notifications", () => {
    const readNotification = { ...baseNotification, read: true };
    render(
      <NotificationItem
        notification={readNotification}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );
    expect(screen.queryByRole("button", { name: /mark as read/i })).not.toBeInTheDocument();
  });

  it("shows dismiss button when onDismiss is provided", () => {
    render(
      <NotificationItem
        notification={baseNotification}
        onDismiss={mockOnDismiss}
      />
    );
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <NotificationItem
        notification={baseNotification}
        onDismiss={mockOnDismiss}
      />
    );

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(mockOnDismiss).toHaveBeenCalledWith("notif-1");
  });

  it("shows snooze button when onSnooze is provided", () => {
    render(
      <NotificationItem
        notification={baseNotification}
        onSnooze={mockOnSnooze}
      />
    );
    expect(screen.getByRole("button", { name: /snooze/i })).toBeInTheDocument();
  });

  it("calls onSnooze when snooze button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <NotificationItem
        notification={baseNotification}
        onSnooze={mockOnSnooze}
      />
    );

    await user.click(screen.getByRole("button", { name: /snooze/i }));
    expect(mockOnSnooze).toHaveBeenCalledWith("notif-1");
  });

  it("does not show actions when handlers are not provided", () => {
    render(<NotificationItem notification={baseNotification} />);
    expect(screen.queryByRole("button", { name: /mark as read/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /snooze/i })).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <NotificationItem
        notification={baseNotification}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("displays relative time for recent notifications", () => {
    // Mock current time to be 2 hours after notification
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));
    render(<NotificationItem notification={baseNotification} />);
    expect(screen.getByText("about 2 hours ago")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("displays formatted date for older notifications", () => {
    const oldNotification = {
      ...baseNotification,
      createdAt: new Date("2026-02-10T10:00:00Z").toISOString(),
    };
    render(<NotificationItem notification={oldNotification} />);
    expect(screen.getByText("Feb 10")).toBeInTheDocument();
  });

  it("shows snoozed indicator when notification is snoozed", () => {
    const snoozedNotification = {
      ...baseNotification,
      snoozedUntil: new Date("2026-02-16T10:00:00Z").toISOString(),
    };
    render(<NotificationItem notification={snoozedNotification} />);
    expect(screen.getByText(/snoozed/i)).toBeInTheDocument();
  });

  it("does not call onClick when notification is disabled", async () => {
    const user = userEvent.setup();
    render(
      <NotificationItem
        notification={baseNotification}
        onClick={mockOnClick}
        disabled
      />
    );

    const button = screen.getByRole("button", { name: /task due soon/i });
    await user.click(button);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("applies disabled styling when disabled", () => {
    const { container } = render(
      <NotificationItem notification={baseNotification} disabled />
    );
    const notificationElement = container.firstChild as HTMLElement;
    expect(notificationElement).toHaveClass("opacity-50");
  });
});
