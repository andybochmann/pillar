import { parse, addDays, addWeeks, addMonths, addYears } from "date-fns";

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
 * Calculate the next due date for a recurring task.
 * @param currentDate - The current due date
 * @param frequency - Recurrence frequency ("daily" | "weekly" | "monthly" | "yearly" | "none")
 * @param interval - Number of frequency units to add (e.g., 2 for every 2 weeks)
 * @returns The next due date, or the current date if frequency is invalid
 */
export function getNextDueDate(
  currentDate: Date,
  frequency: string,
  interval: number,
): Date {
  switch (frequency) {
    case "daily":
      return addDays(currentDate, interval);
    case "weekly":
      return addWeeks(currentDate, interval);
    case "monthly":
      return addMonths(currentDate, interval);
    case "yearly":
      return addYears(currentDate, interval);
    default:
      return currentDate;
  }
}
