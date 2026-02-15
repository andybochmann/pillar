import { describe, it, expect } from "vitest";
import {
  formatDuration,
  computeSessionDuration,
  computeTotalTrackedTime,
} from "./time-format";
import type { TimeSession } from "@/types";

describe("formatDuration", () => {
  it("formats zero milliseconds", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats seconds only (under a minute)", () => {
    expect(formatDuration(45_000)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(formatDuration(5 * 60_000)).toBe("5m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(2 * 3600_000 + 30 * 60_000)).toBe("2h 30m");
  });

  it("formats hours only (no remaining minutes)", () => {
    expect(formatDuration(3 * 3600_000)).toBe("3h 0m");
  });

  it("formats large durations", () => {
    expect(formatDuration(48 * 3600_000 + 15 * 60_000)).toBe("48h 15m");
  });
});

describe("computeSessionDuration", () => {
  it("computes duration for completed session", () => {
    const session: TimeSession = {
      _id: "1",
      startedAt: "2026-02-14T09:00:00Z",
      endedAt: "2026-02-14T10:30:00Z",
      userId: "u1",
    };
    expect(computeSessionDuration(session)).toBe(90 * 60_000);
  });

  it("computes duration for active session using current time", () => {
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
    const session: TimeSession = {
      _id: "2",
      startedAt: fiveMinAgo,
      endedAt: null,
      userId: "u1",
    };
    const duration = computeSessionDuration(session);
    // Should be approximately 5 minutes (allow 2 seconds tolerance)
    expect(duration).toBeGreaterThanOrEqual(5 * 60_000 - 2000);
    expect(duration).toBeLessThanOrEqual(5 * 60_000 + 2000);
  });

  it("computes duration for session with endedAt undefined", () => {
    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60_000).toISOString();
    const session: TimeSession = {
      _id: "3",
      startedAt: tenMinAgo,
      userId: "u1",
    };
    const duration = computeSessionDuration(session);
    expect(duration).toBeGreaterThanOrEqual(10 * 60_000 - 2000);
    expect(duration).toBeLessThanOrEqual(10 * 60_000 + 2000);
  });
});

describe("computeTotalTrackedTime", () => {
  it("returns 0 for empty sessions", () => {
    expect(computeTotalTrackedTime([])).toBe(0);
  });

  it("sums up completed sessions", () => {
    const sessions: TimeSession[] = [
      {
        _id: "1",
        startedAt: "2026-02-14T09:00:00Z",
        endedAt: "2026-02-14T10:00:00Z",
        userId: "u1",
      },
      {
        _id: "2",
        startedAt: "2026-02-14T14:00:00Z",
        endedAt: "2026-02-14T15:30:00Z",
        userId: "u1",
      },
    ];
    // 1h + 1h30m = 2h30m = 150 minutes
    expect(computeTotalTrackedTime(sessions)).toBe(150 * 60_000);
  });

  it("includes active session in total", () => {
    const now = Date.now();
    const sessions: TimeSession[] = [
      {
        _id: "1",
        startedAt: "2026-02-14T09:00:00Z",
        endedAt: "2026-02-14T10:00:00Z",
        userId: "u1",
      },
      {
        _id: "2",
        startedAt: new Date(now - 5 * 60_000).toISOString(),
        endedAt: null,
        userId: "u1",
      },
    ];
    const total = computeTotalTrackedTime(sessions);
    // 1h + ~5m = ~65 minutes
    expect(total).toBeGreaterThanOrEqual(65 * 60_000 - 2000);
    expect(total).toBeLessThanOrEqual(65 * 60_000 + 2000);
  });
});
