import { startOfISOWeek, subWeeks } from "date-fns";

/**
 * A single completed (or open) time session, reduced to just the fields the
 * report cares about. `projectId` is a plain string, dates may be `Date` or
 * ISO strings so this module stays DB-free and trivially unit-testable.
 */
export interface ReportSession {
  projectId: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
}

export interface ProjectTotal {
  projectId: string;
  totalMs: number;
}

export interface WeekTotal {
  /** Local calendar date (YYYY-MM-DD) of the Monday that starts the ISO week. */
  weekStart: string;
  totalMs: number;
}

export interface TimeReportData {
  totalMs: number;
  byProject: ProjectTotal[];
  byWeek: WeekTotal[];
}

export interface BuildTimeReportOptions {
  /** Number of trailing ISO weeks to include (must be >= 1). */
  weeks: number;
  /** "Now" — defaults to the current time. Injectable for deterministic tests. */
  now?: Date;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Duration of a session in milliseconds. Returns 0 for open sessions (no
 * `endedAt`), invalid dates, or non-positive durations (end <= start). This is
 * the single guard every summation relies on.
 */
export function sessionDurationMs(session: ReportSession): number {
  if (session.endedAt == null) return 0;
  const start = toDate(session.startedAt).getTime();
  const end = toDate(session.endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  const ms = end - start;
  return ms > 0 ? ms : 0;
}

/** Local calendar date key (YYYY-MM-DD) for a date, timezone of the runtime. */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The trailing list of ISO-week Monday keys, oldest first, ending at `now`. */
function weekStartKeys(now: Date, weeks: number): string[] {
  const currentWeekStart = startOfISOWeek(now);
  const keys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    keys.push(formatDateKey(subWeeks(currentWeekStart, i)));
  }
  return keys;
}

/**
 * Builds the full time report from a flat list of sessions. All three outputs
 * (`totalMs`, `byProject`, `byWeek`) are scoped to the same trailing window of
 * `weeks` ISO weeks so the numbers are internally consistent. Sessions are
 * bucketed by the week of their `startedAt`. Open/invalid/zero-length sessions
 * and sessions that started before the window are excluded.
 */
export function buildTimeReport(
  sessions: ReportSession[],
  { weeks, now = new Date() }: BuildTimeReportOptions,
): TimeReportData {
  const keys = weekStartKeys(now, weeks);
  const windowStart = startOfISOWeek(subWeeks(now, weeks - 1)).getTime();
  const windowEnd = now.getTime();

  const weekTotals = new Map<string, number>(keys.map((k) => [k, 0]));
  const projectTotals = new Map<string, number>();
  let totalMs = 0;

  for (const session of sessions) {
    const ms = sessionDurationMs(session);
    if (ms === 0) continue;

    const startedAt = toDate(session.startedAt);
    const startTime = startedAt.getTime();
    if (startTime < windowStart || startTime > windowEnd) continue;

    const weekKey = formatDateKey(startOfISOWeek(startedAt));
    // Only count if the session's week is one of the tracked buckets.
    if (!weekTotals.has(weekKey)) continue;
    weekTotals.set(weekKey, weekTotals.get(weekKey)! + ms);

    projectTotals.set(
      session.projectId,
      (projectTotals.get(session.projectId) ?? 0) + ms,
    );
    totalMs += ms;
  }

  const byProject = [...projectTotals.entries()]
    .map(([projectId, ms]) => ({ projectId, totalMs: ms }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const byWeek = keys.map((weekStart) => ({
    weekStart,
    totalMs: weekTotals.get(weekStart)!,
  }));

  return { totalMs, byProject, byWeek };
}
