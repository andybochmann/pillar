import { describe, it, expect } from "vitest";
import {
  sessionDurationMs,
  buildTimeReport,
  type ReportSession,
} from "./time-report";

const HOUR = 3_600_000;

// A fixed "now": Wednesday 2026-07-08 12:00 local. ISO week starts Monday
// 2026-07-06.
const NOW = new Date("2026-07-08T12:00:00");

describe("sessionDurationMs", () => {
  it("computes a positive duration", () => {
    expect(
      sessionDurationMs({
        projectId: "p",
        startedAt: "2026-07-08T10:00:00",
        endedAt: "2026-07-08T11:00:00",
      }),
    ).toBe(HOUR);
  });

  it("excludes open sessions (no endedAt)", () => {
    expect(
      sessionDurationMs({ projectId: "p", startedAt: "2026-07-08T10:00:00" }),
    ).toBe(0);
    expect(
      sessionDurationMs({
        projectId: "p",
        startedAt: "2026-07-08T10:00:00",
        endedAt: null,
      }),
    ).toBe(0);
  });

  it("excludes negative / zero durations", () => {
    expect(
      sessionDurationMs({
        projectId: "p",
        startedAt: "2026-07-08T11:00:00",
        endedAt: "2026-07-08T10:00:00",
      }),
    ).toBe(0);
    expect(
      sessionDurationMs({
        projectId: "p",
        startedAt: "2026-07-08T10:00:00",
        endedAt: "2026-07-08T10:00:00",
      }),
    ).toBe(0);
  });

  it("excludes invalid dates", () => {
    expect(
      sessionDurationMs({
        projectId: "p",
        startedAt: "not-a-date",
        endedAt: "2026-07-08T10:00:00",
      }),
    ).toBe(0);
  });

  it("accepts Date objects", () => {
    expect(
      sessionDurationMs({
        projectId: "p",
        startedAt: new Date("2026-07-08T10:00:00"),
        endedAt: new Date("2026-07-08T12:00:00"),
      }),
    ).toBe(2 * HOUR);
  });
});

describe("buildTimeReport", () => {
  it("returns zeroed report with empty input but full week buckets", () => {
    const report = buildTimeReport([], { weeks: 4, now: NOW });
    expect(report.totalMs).toBe(0);
    expect(report.byProject).toEqual([]);
    expect(report.byWeek).toHaveLength(4);
    expect(report.byWeek.every((w) => w.totalMs === 0)).toBe(true);
    // Oldest first, current week last.
    expect(report.byWeek[3].weekStart).toBe("2026-07-06");
    expect(report.byWeek[0].weekStart).toBe("2026-06-15");
  });

  it("sums totals per project sorted descending", () => {
    const sessions: ReportSession[] = [
      {
        projectId: "a",
        startedAt: "2026-07-06T09:00:00",
        endedAt: "2026-07-06T10:00:00",
      },
      {
        projectId: "b",
        startedAt: "2026-07-07T09:00:00",
        endedAt: "2026-07-07T12:00:00",
      },
      {
        projectId: "a",
        startedAt: "2026-07-07T09:00:00",
        endedAt: "2026-07-07T09:30:00",
      },
    ];
    const report = buildTimeReport(sessions, { weeks: 4, now: NOW });
    expect(report.totalMs).toBe(HOUR + 3 * HOUR + HOUR / 2);
    expect(report.byProject).toEqual([
      { projectId: "b", totalMs: 3 * HOUR },
      { projectId: "a", totalMs: 1.5 * HOUR },
    ]);
  });

  it("buckets sessions into the correct ISO week", () => {
    const sessions: ReportSession[] = [
      // Current week (starts 2026-07-06)
      {
        projectId: "a",
        startedAt: "2026-07-06T09:00:00",
        endedAt: "2026-07-06T10:00:00",
      },
      // Previous week (starts 2026-06-29)
      {
        projectId: "a",
        startedAt: "2026-06-30T09:00:00",
        endedAt: "2026-06-30T11:00:00",
      },
    ];
    const report = buildTimeReport(sessions, { weeks: 4, now: NOW });
    const current = report.byWeek.find((w) => w.weekStart === "2026-07-06");
    const prev = report.byWeek.find((w) => w.weekStart === "2026-06-29");
    expect(current?.totalMs).toBe(HOUR);
    expect(prev?.totalMs).toBe(2 * HOUR);
  });

  it("excludes sessions older than the window", () => {
    const sessions: ReportSession[] = [
      {
        projectId: "a",
        // Well before the 4-week window (window starts 2026-06-15)
        startedAt: "2026-05-01T09:00:00",
        endedAt: "2026-05-01T11:00:00",
      },
    ];
    const report = buildTimeReport(sessions, { weeks: 4, now: NOW });
    expect(report.totalMs).toBe(0);
    expect(report.byProject).toEqual([]);
  });

  it("excludes open sessions from all aggregates", () => {
    const sessions: ReportSession[] = [
      { projectId: "a", startedAt: "2026-07-06T09:00:00" },
      {
        projectId: "a",
        startedAt: "2026-07-06T10:00:00",
        endedAt: "2026-07-06T11:00:00",
      },
    ];
    const report = buildTimeReport(sessions, { weeks: 4, now: NOW });
    expect(report.totalMs).toBe(HOUR);
    expect(report.byProject).toEqual([{ projectId: "a", totalMs: HOUR }]);
  });

  it("handles multiple projects across multiple weeks", () => {
    const sessions: ReportSession[] = [
      {
        projectId: "a",
        startedAt: "2026-07-06T09:00:00",
        endedAt: "2026-07-06T10:00:00",
      },
      {
        projectId: "b",
        startedAt: "2026-06-22T09:00:00",
        endedAt: "2026-06-22T11:00:00",
      },
      {
        projectId: "a",
        startedAt: "2026-06-22T09:00:00",
        endedAt: "2026-06-22T10:00:00",
      },
    ];
    const report = buildTimeReport(sessions, { weeks: 4, now: NOW });
    expect(report.totalMs).toBe(4 * HOUR);
    const week0622 = report.byWeek.find((w) => w.weekStart === "2026-06-22");
    expect(week0622?.totalMs).toBe(3 * HOUR);
    expect(report.byProject).toEqual([
      { projectId: "a", totalMs: 2 * HOUR },
      { projectId: "b", totalMs: 2 * HOUR },
    ]);
  });
});
