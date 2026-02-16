import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OfflineBanner } from "./offline-banner";

const mockUseOfflineQueue = vi.fn();

vi.mock("@/hooks/use-offline-queue", () => ({
  useOfflineQueue: () => mockUseOfflineQueue(),
}));

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when online with empty queue", () => {
    mockUseOfflineQueue.mockReturnValue({
      isOnline: true,
      queueCount: 0,
      syncing: false,
      syncNow: vi.fn(),
    });

    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows offline message when offline with no pending changes", () => {
    mockUseOfflineQueue.mockReturnValue({
      isOnline: false,
      queueCount: 0,
      syncing: false,
      syncNow: vi.fn(),
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows offline message with pending change count", () => {
    mockUseOfflineQueue.mockReturnValue({
      isOnline: false,
      queueCount: 3,
      syncing: false,
      syncNow: vi.fn(),
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pending changes/)).toBeInTheDocument();
  });

  it("shows singular 'change' for 1 pending item when offline", () => {
    mockUseOfflineQueue.mockReturnValue({
      isOnline: false,
      queueCount: 1,
      syncing: false,
      syncNow: vi.fn(),
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/1 pending change$/)).toBeInTheDocument();
  });

  it("shows syncing state when online and syncing", () => {
    mockUseOfflineQueue.mockReturnValue({
      isOnline: true,
      queueCount: 2,
      syncing: true,
      syncNow: vi.fn(),
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/syncing 2 changes/i)).toBeInTheDocument();
  });

  it("shows pending changes with sync button when online and not syncing", () => {
    mockUseOfflineQueue.mockReturnValue({
      isOnline: true,
      queueCount: 5,
      syncing: false,
      syncNow: vi.fn(),
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/5 pending changes/)).toBeInTheDocument();
    expect(screen.getByText("Sync now")).toBeInTheDocument();
  });

  it("calls syncNow when sync button is clicked", async () => {
    const syncNow = vi.fn();
    mockUseOfflineQueue.mockReturnValue({
      isOnline: true,
      queueCount: 1,
      syncing: false,
      syncNow,
    });

    const user = userEvent.setup();
    render(<OfflineBanner />);

    await user.click(screen.getByText("Sync now"));
    expect(syncNow).toHaveBeenCalledOnce();
  });

  it("has a status role for accessibility", () => {
    mockUseOfflineQueue.mockReturnValue({
      isOnline: false,
      queueCount: 0,
      syncing: false,
      syncNow: vi.fn(),
    });

    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
