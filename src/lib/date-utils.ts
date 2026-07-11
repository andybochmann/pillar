import { parse, addDays, addWeeks } from "date-fns";

/** Parse a "YYYY-MM-DD" string as local midnight (not UTC). */
export function parseLocalDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date(2000, 0, 1));
}

/**
 * Get the current calendar date string (YYYY-MM-DD) in the given IANA timezone.
 * Uses Intl to correctly determine what date it is for the user.
 */
export function getCurrentDateInTimezone(
  timezone: string,
  now: Date = new Date(),
): string {
  return now.toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * Get UTC midnight for a calendar date string (YYYY-MM-DD).
 * Since due dates are stored as midnight UTC, this gives the correct
 * start boundary for querying tasks on a specific calendar date.
 */
export function startOfDayUTC(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

/**
 * Get UTC end-of-day (23:59:59.999) for a calendar date string (YYYY-MM-DD).
 * Since due dates are stored as midnight UTC, this gives the correct
 * end boundary for querying tasks on a specific calendar date.
 */
export function endOfDayUTC(dateStr: string): Date {
  return new Date(dateStr + "T23:59:59.999Z");
}

/** Convert an ISO datetime string to a local-midnight Date (strips time/timezone). */
export function toLocalDate(isoString: string): Date {
  return parseLocalDate(isoString.slice(0, 10));
}

/**
 * Add whole months to a date, anchoring to a specific day-of-month and clamping
 * only when the target month is shorter. Preserves the time-of-day components.
 *
 * Unlike date-fns `addMonths`, which drifts permanently once a value has been
 * clamped (Jan 31 → Feb 28 → Mar 28 …), passing the original `anchorDay`
 * (e.g. 31) lets the sequence recover to the longest valid day each month
 * (Jan 31 → Feb 28 → Mar 31 …).
 */
function addMonthsAnchored(
  currentDate: Date,
  monthsToAdd: number,
  anchorDay: number,
): Date {
  const totalMonths = currentDate.getMonth() + monthsToAdd;
  const targetYear = currentDate.getFullYear() + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  // Day 0 of the following month === last day of the target month.
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(anchorDay, daysInTargetMonth);
  return new Date(
    targetYear,
    targetMonth,
    day,
    currentDate.getHours(),
    currentDate.getMinutes(),
    currentDate.getSeconds(),
    currentDate.getMilliseconds(),
  );
}

/**
 * Calculate the next due date for a recurring task.
 * @param currentDate - The current due date
 * @param frequency - Recurrence frequency ("daily" | "weekly" | "monthly" | "yearly" | "none")
 * @param interval - Number of frequency units to add (e.g., 2 for every 2 weeks)
 * @param anchorDay - Optional original day-of-month to anchor monthly/yearly
 *   recurrence to. When omitted, the current date's day is used (matching the
 *   previous behavior). Ignored for daily/weekly frequencies.
 * @returns The next due date, or the current date if frequency is invalid
 */
export function getNextDueDate(
  currentDate: Date,
  frequency: string,
  interval: number,
  anchorDay?: number,
): Date {
  const day = anchorDay ?? currentDate.getDate();
  switch (frequency) {
    case "daily":
      return addDays(currentDate, interval);
    case "weekly":
      return addWeeks(currentDate, interval);
    case "monthly":
      return addMonthsAnchored(currentDate, interval, day);
    case "yearly":
      return addMonthsAnchored(currentDate, interval * 12, day);
    default:
      return currentDate;
  }
}
