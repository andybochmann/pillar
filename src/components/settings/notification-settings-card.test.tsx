import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationSettingsCard } from "./notification-settings-card";

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockPreferences = {
  id: "pref1",
  userId: "user1",
  enableInAppNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  enableOverdueSummary: true,
  enableDailySummary: true,
  dailySummaryTime: "09:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("NotificationSettingsCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {}),
    );

    render(<NotificationSettingsCard />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("fetches and displays preferences", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByText("Notification Settings")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("In-App Notifications")).toBeChecked();
  });

  it("handles fetch error gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load preferences")).toBeInTheDocument();
    });
  });

  it("toggles in-app notifications", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockPreferences, enableInAppNotifications: false }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("In-App Notifications")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("In-App Notifications");
    await user.click(toggle);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ enableInAppNotifications: false }),
        }),
      );
    });
  });

  it("toggles quiet hours", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockPreferences, quietHoursEnabled: true }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Quiet Hours")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Quiet Hours");
    await user.click(toggle);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ quietHoursEnabled: true }),
        }),
      );
    });
  });

  it("shows quiet hours inputs when enabled", async () => {
    const prefsWithQuietHours = {
      ...mockPreferences,
      quietHoursEnabled: true,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(prefsWithQuietHours),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Start")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("End")).toBeInTheDocument();
    expect(screen.getByLabelText("Start")).toHaveValue("22:00");
    expect(screen.getByLabelText("End")).toHaveValue("08:00");
  });

  it("toggles overdue summary", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockPreferences, enableOverdueSummary: false }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Overdue Task Alerts")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Alerts");
    await user.click(toggle);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ enableOverdueSummary: false }),
        }),
      );
    });
  });

  it("shows success toast on update", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockPreferences, enableOverdueSummary: false }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Overdue Task Alerts")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Alerts");
    await user.click(toggle);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Preferences updated");
    });
  });

  it("shows error toast on update failure", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Update failed" }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Overdue Task Alerts")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Alerts");
    await user.click(toggle);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  it("renders test notification button", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Send Test Notification/i }),
      ).toBeInTheDocument();
    });
  });

  it("test notification button is always enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Send Test Notification/i }),
      ).not.toBeDisabled();
    });
  });

  it("sends test notification via API when button clicked", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ _id: "test-notif" }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Send Test Notification/i }),
      ).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /Send Test Notification/i });
    await user.click(button);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            type: "reminder",
            title: "Test Notification",
            message: "Your notification settings are working!",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Test notification sent");
    });
  });

  it("toggles daily summary", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockPreferences, enableDailySummary: false }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Daily Summary")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Daily Summary");
    await user.click(toggle);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ enableDailySummary: false }),
        }),
      );
    });
  });

  it("shows summary time input when daily summary is enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Summary Time")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Summary Time")).toHaveValue("09:00");
  });

  it("hides summary time input when daily summary is disabled", async () => {
    const prefsWithoutSummary = {
      ...mockPreferences,
      enableDailySummary: false,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(prefsWithoutSummary),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Daily Summary")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Summary Time")).not.toBeInTheDocument();
  });
});
