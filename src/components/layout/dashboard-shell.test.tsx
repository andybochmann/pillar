import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardShell } from "./dashboard-shell";

// Mock overlay-stack — track calls to cleanupOverlay vs removeOverlay
const overlayStack = vi.hoisted(() => ({
  pushOverlay: vi.fn(),
  removeOverlay: vi.fn(),
  cleanupOverlay: vi.fn(),
  getStackSize: vi.fn(() => 0),
  _reset: vi.fn(),
}));

vi.mock("@/lib/overlay-stack", () => overlayStack);

vi.mock("@/hooks/use-back-button", () => ({
  useBackButton: vi.fn(),
}));

// Capture the onNavigate prop passed to Sidebar
let capturedOnNavigate: (() => void) | undefined;

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({ onNavigate }: { onNavigate?: () => void }) => {
    capturedOnNavigate = onNavigate;
    return (
      <nav data-testid="sidebar">
        {onNavigate && (
          <button data-testid="nav-link" onClick={onNavigate}>
            Overview
          </button>
        )}
      </nav>
    );
  },
}));

vi.mock("@/components/layout/topbar", () => ({
  Topbar: ({ onMenuToggle }: { onMenuToggle: () => void }) => (
    <button data-testid="menu-toggle" onClick={onMenuToggle}>
      Menu
    </button>
  ),
}));

describe("DashboardShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnNavigate = undefined;
  });

  it("passes handleNavigateClose to mobile Sidebar onNavigate", async () => {
    const user = userEvent.setup();
    render(<DashboardShell>Content</DashboardShell>);

    // Open mobile drawer
    await user.click(screen.getByTestId("menu-toggle"));

    // The Sidebar rendered inside the Sheet should have received onNavigate
    expect(capturedOnNavigate).toBeDefined();
  });

  it("calls cleanupOverlay (not removeOverlay) when onNavigate fires", async () => {
    const user = userEvent.setup();
    render(<DashboardShell>Content</DashboardShell>);

    // Open mobile drawer
    await user.click(screen.getByTestId("menu-toggle"));

    // Simulate nav link click
    const navLink = screen.getByTestId("nav-link");
    await user.click(navLink);

    // cleanupOverlay should be called — removes from stack without history.back()
    expect(overlayStack.cleanupOverlay).toHaveBeenCalledWith("mobile-nav");

    // removeOverlay should NOT be called — it would call history.back()
    expect(overlayStack.removeOverlay).not.toHaveBeenCalled();
  });
});
