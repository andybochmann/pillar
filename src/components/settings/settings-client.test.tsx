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
  createdAt: new Date().toISOString(),
};

describe("SettingsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
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
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ name: "New Name" }),
    });

    render(<SettingsClient profile={mockProfile} />);
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
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
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Password updated" }),
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
      expect(global.fetch).toHaveBeenCalledWith(
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
