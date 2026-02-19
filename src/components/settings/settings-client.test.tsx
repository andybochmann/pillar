import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsClient } from "./settings-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

const mockProfile = {
  id: "user1",
  name: "Test User",
  email: "test@pillar.dev",
  hasPassword: true,
  providers: ["credentials"],
  createdAt: new Date().toISOString(),
};

function mockFetchResponses(responses: Record<string, unknown> = {}) {
  const mockFn = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr =
      typeof url === "string"
        ? url
        : url instanceof URL
          ? url.toString()
          : url.url;

    // Always return empty array for token fetches
    if (urlStr.includes("/api/settings/tokens")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);
    }

    // Return default notification preferences for GET requests
    if (
      (urlStr.includes("/api/notifications/preferences") && !init?.method) ||
      init?.method === "GET"
    ) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            enableInAppNotifications: true,
            enableBrowserPush: false,
            quietHoursEnabled: false,
            quietHoursStart: "22:00",
            quietHoursEnd: "08:00",
            enableOverdueSummary: true,
            overdueSummaryTime: "09:00",
            enableDailySummary: true,
            dailySummaryTime: "09:00",
            dueDateReminders: [
              { daysBefore: 1, time: "09:00" },
              { daysBefore: 0, time: "08:00" },
            ],
            timezone: "UTC",
          }),
      } as Response);
    }

    // Check for matching response by URL pattern
    for (const [pattern, data] of Object.entries(responses)) {
      if (urlStr.includes(pattern) && init?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
        } as Response);
      }
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  }) as unknown as typeof fetch;

  global.fetch = mockFn;
  return mockFn;
}

describe("SettingsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetchResponses();
  });

  it("renders profile, password, and danger sections", () => {
    render(<SettingsClient profile={mockProfile} />);
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("Change Password")).toBeTruthy();
    expect(screen.getByText("Danger Zone")).toBeTruthy();
  });

  it("shows email as disabled", () => {
    render(<SettingsClient profile={mockProfile} />);
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    expect(emailInput.disabled).toBe(true);
    expect(emailInput.value).toBe("test@pillar.dev");
  });

  it("saves profile name", async () => {
    const mockFn = mockFetchResponses({
      "/api/settings/profile": { name: "New Name" },
    });

    render(<SettingsClient profile={mockProfile} />);
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith(
        "/api/settings/profile",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("disables save button when name is empty", () => {
    render(<SettingsClient profile={mockProfile} />);
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "" } });
    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    expect(saveBtn).toBeDisabled();
  });

  it("disables change password when fields are empty", () => {
    render(<SettingsClient profile={mockProfile} />);
    const btn = screen.getByRole("button", { name: "Change password" });
    expect(btn).toBeDisabled();
  });

  it("calls password change API", async () => {
    const mockFn = mockFetchResponses({
      "/api/settings/password": { message: "Password updated" },
    });

    render(<SettingsClient profile={mockProfile} />);
    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "OldPass123!" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "NewPass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "NewPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith(
        "/api/settings/password",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("shows delete account confirmation dialog", async () => {
    render(<SettingsClient profile={mockProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => {
      expect(screen.getByText("Delete account?")).toBeTruthy();
    });
  });
});
