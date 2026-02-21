import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataBackupCard } from "./data-backup-card";

// Mock sonner toast
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL methods
const mockCreateObjectURL = vi.fn(() => "blob:http://localhost/fake-url");
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

function getFileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function simulateFileSelect(fileInput: HTMLInputElement, content: string) {
  const file = new File([content], "backup.json", {
    type: "application/json",
  });
  // jsdom File.text() may not work reliably — mock it
  file.text = () => Promise.resolve(content);
  Object.defineProperty(fileInput, "files", {
    value: [file],
    configurable: true,
  });
  fireEvent.change(fileInput);
}

describe("DataBackupCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders card with title and description", () => {
    render(<DataBackupCard />);
    expect(screen.getByText("Data Backup")).toBeInTheDocument();
    expect(
      screen.getByText(/Export or import your data/),
    ).toBeInTheDocument();
  });

  it("renders export and import buttons", () => {
    render(<DataBackupCard />);
    expect(
      screen.getByRole("button", { name: /export/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /import/i }),
    ).toBeInTheDocument();
  });

  it("calls export API and triggers download", async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob([JSON.stringify({ metadata: {} })], {
      type: "application/json",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: new Headers({
        "Content-Disposition":
          'attachment; filename="pillar-backup-2026-02-21.json"',
      }),
    });

    render(<DataBackupCard />);
    await user.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/backup");
    });

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockToast.success).toHaveBeenCalledWith("Backup exported");
    });
  });

  it("shows error toast when export fails", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    render(<DataBackupCard />);
    await user.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Server error");
    });
  });

  it("has a hidden file input for import", () => {
    render(<DataBackupCard />);
    const fileInput = getFileInput();
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe(".json");
  });

  it("shows confirmation dialog after selecting a file", async () => {
    render(<DataBackupCard />);
    simulateFileSelect(getFileInput(), JSON.stringify({ test: true }));

    await waitFor(() => {
      expect(
        screen.getByText(/This will replace all your existing data/),
      ).toBeInTheDocument();
    });
  });

  it("imports backup on confirmation and shows success toast", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: {
            categories: 2,
            labels: 3,
            projects: 1,
            tasks: 5,
            notes: 0,
            notificationPreference: true,
          },
        }),
    });

    render(<DataBackupCard />);
    simulateFileSelect(getFileInput(), JSON.stringify({ test: true }));

    await waitFor(() => {
      expect(
        screen.getByText(/This will replace all your existing data/),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Yes, import/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/settings/backup",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  it("shows error toast when import fails", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Invalid backup format" }),
    });

    render(<DataBackupCard />);
    simulateFileSelect(getFileInput(), JSON.stringify({ test: true }));

    await waitFor(() => {
      expect(
        screen.getByText(/This will replace all your existing data/),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Yes, import/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid backup format");
    });
  });
});
