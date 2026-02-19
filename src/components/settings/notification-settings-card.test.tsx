import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationSettingsCard } from "./notification-settings-card";

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock useNotificationPermission hook
const mockRequestPermission = vi.fn();
vi.mock("@/hooks/use-notification-permission", () => ({
  useNotificationPermission: vi.fn(() => ({
    permission: "default",
    requestPermission: mockRequestPermission,
    isSupported: true,
  })),
}));

// Mock usePushSubscription hook
const mockPushSubscribe = vi.fn().mockResolvedValue(true);
const mockPushUnsubscribe = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/use-push-subscription", () => ({
  usePushSubscription: vi.fn(() => ({
    subscribe: mockPushSubscribe,
    unsubscribe: mockPushUnsubscribe,
    loading: false,
    error: null,
  })),
}));

const mockPreferences = {
  id: "pref1",
  userId: "user1",
  enableBrowserPush: false,
  enableInAppNotifications: true,
  dueDateReminders: [
    { daysBefore: 1, time: "09:00" },
    { daysBefore: 0, time: "08:00" },
  ],
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  enableOverdueSummary: true,
  timezone: "UTC",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("NotificationSettingsCard", () => {
  let resolvedOptionsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRequestPermission.mockReset();
    mockPushSubscribe.mockReset().mockResolvedValue(true);
    mockPushUnsubscribe.mockReset().mockResolvedValue(true);

    // Default: browser timezone matches stored "UTC" so auto-inject doesn't
    // add timezone to every PATCH request, keeping existing tests stable.
    resolvedOptionsSpy = vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions",
    );
    resolvedOptionsSpy.mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "UTC",
    } as Intl.ResolvedDateTimeFormatOptions);
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

    expect(
      screen.getByLabelText("Browser Push Notifications"),
    ).not.toBeChecked();
    expect(screen.getByLabelText("In-App Notifications")).toBeChecked();
  });

  it("handles fetch error gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load preferences"),
      ).toBeInTheDocument();
    });
  });

  it("toggles browser push notifications with permission request", async () => {
    const user = userEvent.setup();
    mockRequestPermission.mockResolvedValue("granted");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockPreferences, enableBrowserPush: true }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Browser Push Notifications"),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Browser Push Notifications");
    await user.click(toggle);

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/notifications/preferences",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enableBrowserPush: true }),
      }),
    );
  });

  it("does not enable browser push if permission denied", async () => {
    const user = userEvent.setup();
    mockRequestPermission.mockResolvedValue("denied");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Browser Push Notifications"),
      ).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Browser Push Notifications");
    await user.click(toggle);

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
    });

    // PATCH should not be called
    expect(
      Array.from(
        (
          globalThis.fetch as typeof fetch & {
            mock: { calls: [string, RequestInit][] };
          }
        ).mock.calls,
      ).filter(([, opts]) => opts?.method === "PATCH"),
    ).toHaveLength(0);
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
          Promise.resolve({
            ...mockPreferences,
            enableInAppNotifications: false,
          }),
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

  it("displays due date reminders", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByText("Due Date Reminders")).toBeInTheDocument();
    });

    // Should show 2 reminders
    expect(screen.getAllByLabelText(/Reminder \d+ time/)).toHaveLength(2);
  });

  it("adds a new reminder when Add button is clicked", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockPreferences,
            dueDateReminders: [
              ...mockPreferences.dueDateReminders,
              { daysBefore: 1, time: "09:00" },
            ],
          }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Add reminder/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Add reminder/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            dueDateReminders: [
              { daysBefore: 1, time: "09:00" },
              { daysBefore: 0, time: "08:00" },
              { daysBefore: 1, time: "09:00" },
            ],
          }),
        }),
      );
    });
  });

  it("removes a reminder when trash button is clicked", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockPreferences,
            dueDateReminders: [{ daysBefore: 0, time: "08:00" }],
          }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Remove reminder 1")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Remove reminder 1"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            dueDateReminders: [{ daysBefore: 0, time: "08:00" }],
          }),
        }),
      );
    });
  });

  it("shows empty state when no reminders configured", async () => {
    const prefsWithoutReminders = {
      ...mockPreferences,
      dueDateReminders: [],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(prefsWithoutReminders),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByText(/No reminders configured/)).toBeInTheDocument();
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

  it("displays quiet hours start and end time inputs with correct values", async () => {
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

    const startInput = screen.getByLabelText("Start") as HTMLInputElement;
    const endInput = screen.getByLabelText("End") as HTMLInputElement;

    expect(startInput.value).toBe("22:00");
    expect(endInput.value).toBe("08:00");
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
      expect(screen.getByLabelText("Overdue Task Summary")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Summary");
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

  it("disables browser push toggle when not supported", async () => {
    const { useNotificationPermission } =
      await import("@/hooks/use-notification-permission");
    vi.mocked(useNotificationPermission).mockReturnValue({
      permission: "default",
      requestPermission: mockRequestPermission,
      isSupported: false,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Browser Push Notifications"),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Browser Push Notifications")).toBeDisabled();
    expect(
      screen.getByText(/Not supported in this browser/),
    ).toBeInTheDocument();
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
      expect(screen.getByLabelText("Overdue Task Summary")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Summary");
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
      expect(screen.getByLabelText("Overdue Task Summary")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Summary");
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
        screen.getByRole("button", { name: /Test Local Notification/i }),
      ).toBeInTheDocument();
    });
  });

  it("test notification button is disabled when permission not granted", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Test Local Notification/i }),
      ).toBeDisabled();
    });
  });

  it("sends test notification via service worker when controller available", async () => {
    const user = userEvent.setup();
    const { useNotificationPermission } =
      await import("@/hooks/use-notification-permission");
    vi.mocked(useNotificationPermission).mockReturnValue({
      permission: "granted",
      requestPermission: mockRequestPermission,
      isSupported: true,
    });

    // Mock service worker controller
    const mockPostMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: { postMessage: mockPostMessage } },
      configurable: true,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Test Local Notification/i }),
      ).toBeInTheDocument();
    });

    const button = screen.getByRole("button", {
      name: /Test Local Notification/i,
    });
    await user.click(button);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "SHOW_NOTIFICATION",
      title: "Test Local Notification",
      body: "Browser notification display is working!",
    });
  });

  it("falls back to Notification constructor when no service worker controller", async () => {
    const user = userEvent.setup();
    const { useNotificationPermission } =
      await import("@/hooks/use-notification-permission");
    vi.mocked(useNotificationPermission).mockReturnValue({
      permission: "granted",
      requestPermission: mockRequestPermission,
      isSupported: true,
    });

    // No service worker controller
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: null },
      configurable: true,
    });

    // Mock Notification constructor
    const mockNotification = vi.fn() as unknown as typeof Notification;
    global.Notification = mockNotification;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Test Local Notification/i }),
      ).toBeInTheDocument();
    });

    const button = screen.getByRole("button", {
      name: /Test Local Notification/i,
    });
    await user.click(button);

    expect(mockNotification).toHaveBeenCalledWith(
      "Test Local Notification",
      expect.objectContaining({
        body: "Browser notification display is working!",
      }),
    );
  });

  it("auto-includes detected timezone when it differs from stored preference", async () => {
    const user = userEvent.setup();

    // Browser timezone differs from stored "UTC"
    resolvedOptionsSpy.mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "America/Chicago",
    } as Intl.ResolvedDateTimeFormatOptions);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockPreferences, timezone: "UTC" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockPreferences,
            enableOverdueSummary: false,
            timezone: "America/Chicago",
          }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Overdue Task Summary")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Summary");
    await user.click(toggle);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            enableOverdueSummary: false,
            timezone: "America/Chicago",
          }),
        }),
      );
    });
  });

  it("does not include timezone when browser timezone matches stored preference", async () => {
    const user = userEvent.setup();

    // resolvedOptionsSpy already returns "UTC" from beforeEach

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockPreferences, timezone: "UTC" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockPreferences,
            enableOverdueSummary: false,
          }),
      } as Response);

    render(<NotificationSettingsCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Overdue Task Summary")).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText("Overdue Task Summary");
    await user.click(toggle);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/notifications/preferences",
        expect.objectContaining({
          method: "PATCH",
          // Should NOT include timezone since browser matches stored
          body: JSON.stringify({ enableOverdueSummary: false }),
        }),
      );
    });
  });
});
