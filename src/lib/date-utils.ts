import { parse } from "date-fns";

/** Parse a "YYYY-MM-DD" string as local midnight (not UTC). */
export function parseLocalDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date(2000, 0, 1));
}
