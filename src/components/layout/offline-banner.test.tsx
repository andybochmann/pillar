import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfflineBanner } from "./offline-banner";

describe("OfflineBanner", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  it("renders nothing when online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    expect(
      screen.getByText(/you're offline/i),
    ).toBeInTheDocument();
  });

  it("has a status role for accessibility", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
