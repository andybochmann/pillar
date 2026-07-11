import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarFeedCard } from "./calendar-feed-card";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const FEED_URL =
  "https://pillar.example.com/api/calendar/" + "a".repeat(64) + "/feed.ics";

describe("CalendarFeedCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  });

  it("renders the Calendar Feed heading", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: false, url: null }),
    } as Response);
    render(<CalendarFeedCard />);
    expect(screen.getByText("Calendar Feed")).toBeInTheDocument();
  });

  it("shows the enable button when the feed is not enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: false, url: null }),
    } as Response);
    render(<CalendarFeedCard />);
    await waitFor(() => {
      expect(
        screen.getByText("Calendar feed is not enabled"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /enable calendar feed/i }),
    ).toBeInTheDocument();
  });

  it("shows the feed URL and a privacy warning when enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: true, url: FEED_URL }),
    } as Response);
    render(<CalendarFeedCard />);
    await waitFor(() => {
      expect(screen.getByText(FEED_URL)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/anyone with this url can see/i),
    ).toBeInTheDocument();
  });

  it("enabling the feed calls the API and reveals the URL", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ enabled: false, url: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ enabled: true, url: FEED_URL }),
      } as Response);

    render(<CalendarFeedCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /enable calendar feed/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /enable calendar feed/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(FEED_URL)).toBeInTheDocument();
    });
  });

  it("copies the URL to the clipboard", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: true, url: FEED_URL }),
    } as Response);

    render(<CalendarFeedCard />);
    await waitFor(() => {
      expect(screen.getByText(FEED_URL)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Copy calendar feed URL"));
    expect(toast.success).toHaveBeenCalledWith("Feed URL copied to clipboard");
  });
});
