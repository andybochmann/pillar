import { parse, addDays, addWeeks, addMonths, addYears } from "date-fns";

/** Parse a "YYYY-MM-DD" string as local midnight (not UTC). */
export function parseLocalDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date(2000, 0, 1));
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
