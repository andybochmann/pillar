import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { InstallPromptCard } from "./install-prompt-card";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
}

describe("InstallPromptCard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockMatchMedia(false);
  });

  it("renders nothing when no beforeinstallprompt event fires", () => {
    const { container } = render(<InstallPromptCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when already dismissed", () => {
    localStorage.setItem("pillar-install-dismissed", "true");
    const { container } = render(<InstallPromptCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when running in standalone mode", () => {
    mockMatchMedia(true);
    const { container } = render(<InstallPromptCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders install card when beforeinstallprompt fires", async () => {
    render(<InstallPromptCard />);

    // Simulate beforeinstallprompt
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(screen.getByText("Install Pillar")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /install/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dismiss/i }),
    ).toBeInTheDocument();
  });

  it("persists dismissal to localStorage", async () => {
    render(<InstallPromptCard />);

    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    const dismissBtn = screen.getByRole("button", { name: /dismiss/i });
    await act(async () => {
      dismissBtn.click();
    });

    expect(localStorage.getItem("pillar-install-dismissed")).toBe("true");
  });
});
