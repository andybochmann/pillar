import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeReportView } from "./time-report-view";
import type { TimeReport } from "@/types";

const mockUseTimeReport = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-time-report", () => ({
  useTimeReport: (weeks: number) => mockUseTimeReport(weeks),
}));

const HOUR = 3_600_000;

function setReport(report: TimeReport | null, extra: Record<string, unknown> = {}) {
  mockUseTimeReport.mockReturnValue({
    report,
    loading: false,
    error: null,
    refresh: vi.fn(),
    ...extra,
  });
}

describe("TimeReportView", () => {
  beforeEach(() => {
    mockUseTimeReport.mockReset();
  });

  it("renders the total tracked time", () => {
    setReport({
      totalMs: 3 * HOUR,
      byProject: [
        { projectId: "a", projectName: "Alpha", totalMs: 2 * HOUR },
        { projectId: "b", projectName: "Beta", totalMs: HOUR },
      ],
      byWeek: [{ weekStart: "2026-07-06", totalMs: 3 * HOUR }],
    });
    render(<TimeReportView />);
    expect(screen.getByText("Total tracked")).toBeInTheDocument();
    // The total (3h) is unique to the summary card.
    expect(screen.getByText("3h 0m 0s")).toBeInTheDocument();
  });

  it("renders per-project bars with accessible labels", () => {
    setReport({
      totalMs: 4 * HOUR,
      byProject: [
        { projectId: "a", projectName: "Alpha", totalMs: 3 * HOUR },
        { projectId: "b", projectName: "Beta", totalMs: 1 * HOUR },
      ],
      byWeek: [{ weekStart: "2026-07-06", totalMs: 4 * HOUR }],
    });
    render(<TimeReportView />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // Bars expose their data via aria-label (not color alone).
    expect(
      screen.getByLabelText("Alpha: 3h 0m 0s (75% of total)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Beta: 1h 0m 0s (25% of total)"),
    ).toBeInTheDocument();
  });

  it("renders the weekly trend with labeled bars", () => {
    setReport({
      totalMs: HOUR,
      byProject: [{ projectId: "a", projectName: "Alpha", totalMs: HOUR }],
      byWeek: [
        { weekStart: "2026-06-29", totalMs: 0 },
        { weekStart: "2026-07-06", totalMs: HOUR },
      ],
    });
    render(<TimeReportView />);
    expect(
      screen.getByLabelText("Week of Jul 6: 1h 0m 0s"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Week of Jun 29: 0m 0s"),
    ).toBeInTheDocument();
  });

  it("renders the empty state when no time is tracked", () => {
    setReport({ totalMs: 0, byProject: [], byWeek: [] });
    render(<TimeReportView />);
    expect(screen.getByText("No time tracked yet")).toBeInTheDocument();
    expect(screen.queryByText("Total tracked")).not.toBeInTheDocument();
  });

  it("renders an error message", () => {
    setReport(null, { error: "Failed to fetch time report" });
    render(<TimeReportView />);
    expect(
      screen.getByText("Failed to fetch time report"),
    ).toBeInTheDocument();
  });
});
