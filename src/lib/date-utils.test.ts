import { describe, it, expect } from "vitest";
import { parseLocalDate, toLocalDate, getNextDueDate } from "./date-utils";

describe("parseLocalDate", () => {
  it("parses a date string as local midnight", () => {
    const date = parseLocalDate("2026-02-13");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // February (0-indexed)
    expect(date.getDate()).toBe(13);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
    expect(date.getMilliseconds()).toBe(0);
  });

  it("returns a different result than new Date() for date-only strings in non-UTC zones", () => {
    // This test documents the bug: new Date("2026-02-13") is UTC midnight,
    // which shifts the local date in non-UTC timezones.
    const local = parseLocalDate("2026-02-13");
    // getDate() should always be 13 regardless of timezone
    expect(local.getDate()).toBe(13);
  });

  it("handles year boundaries correctly", () => {
    const date = parseLocalDate("2025-12-31");
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(31);
  });

  it("handles January 1st correctly", () => {
    const date = parseLocalDate("2026-01-01");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });
});

describe("toLocalDate", () => {
  it("extracts the correct local date from a UTC midnight ISO string", () => {
    // This is the core bug: new Date("2025-01-15T00:00:00.000Z") in EST
    // would be Jan 14 at 7pm, but toLocalDate should return Jan 15
    const date = toLocalDate("2025-01-15T00:00:00.000Z");
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("works with non-midnight UTC times", () => {
    const date = toLocalDate("2025-01-15T05:00:00.000Z");
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(15);
  });

  it("works with timezone offsets in the string", () => {
    const date = toLocalDate("2025-06-20T18:30:00+05:30");
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(5); // June
    expect(date.getDate()).toBe(20);
  });

  it("handles year boundaries correctly", () => {
    const date = toLocalDate("2025-12-31T00:00:00.000Z");
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(31);
  });

  it("handles date-only prefix extraction correctly", () => {
    const date = toLocalDate("2026-02-20T00:00:00.000Z");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // February
    expect(date.getDate()).toBe(20);
  });
});

describe("getNextDueDate", () => {
  describe("daily frequency", () => {
    it("adds 1 day when interval is 1", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "daily", 1);
      expect(nextDate.getDate()).toBe(16);
      expect(nextDate.getMonth()).toBe(1); // February
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("adds 2 days when interval is 2", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "daily", 2);
      expect(nextDate.getDate()).toBe(17);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("adds 7 days when interval is 7", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "daily", 7);
      expect(nextDate.getDate()).toBe(22);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("handles month boundary correctly", () => {
      const currentDate = new Date(2026, 1, 28); // Feb 28, 2026
      const nextDate = getNextDueDate(currentDate, "daily", 1);
      expect(nextDate.getDate()).toBe(1);
      expect(nextDate.getMonth()).toBe(2); // March
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("handles year boundary correctly", () => {
      const currentDate = new Date(2025, 11, 31); // Dec 31, 2025
      const nextDate = getNextDueDate(currentDate, "daily", 1);
      expect(nextDate.getDate()).toBe(1);
      expect(nextDate.getMonth()).toBe(0); // January
      expect(nextDate.getFullYear()).toBe(2026);
    });
  });

  describe("weekly frequency", () => {
    it("adds 1 week when interval is 1", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "weekly", 1);
      expect(nextDate.getDate()).toBe(22);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("adds 2 weeks when interval is 2", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "weekly", 2);
      expect(nextDate.getDate()).toBe(1);
      expect(nextDate.getMonth()).toBe(2); // March
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("adds 4 weeks when interval is 4", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "weekly", 4);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(2); // March
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("handles month boundary correctly", () => {
      const currentDate = new Date(2026, 1, 26); // Feb 26, 2026
      const nextDate = getNextDueDate(currentDate, "weekly", 1);
      expect(nextDate.getDate()).toBe(5);
      expect(nextDate.getMonth()).toBe(2); // March
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("handles year boundary correctly", () => {
      const currentDate = new Date(2025, 11, 28); // Dec 28, 2025
      const nextDate = getNextDueDate(currentDate, "weekly", 1);
      expect(nextDate.getDate()).toBe(4);
      expect(nextDate.getMonth()).toBe(0); // January
      expect(nextDate.getFullYear()).toBe(2026);
    });
  });

  describe("monthly frequency", () => {
    it("adds 1 month when interval is 1", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "monthly", 1);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(2); // March
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("adds 2 months when interval is 2", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "monthly", 2);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(3); // April
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("adds 6 months when interval is 6", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "monthly", 6);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(7); // August
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("handles year boundary correctly", () => {
      const currentDate = new Date(2025, 10, 15); // Nov 15, 2025
      const nextDate = getNextDueDate(currentDate, "monthly", 2);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(0); // January
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("handles month-end dates correctly (31st to shorter month)", () => {
      const currentDate = new Date(2026, 0, 31); // Jan 31, 2026
      const nextDate = getNextDueDate(currentDate, "monthly", 1);
      // date-fns handles this by setting to last day of February (28th in non-leap year)
      expect(nextDate.getDate()).toBe(28);
      expect(nextDate.getMonth()).toBe(1); // February
      expect(nextDate.getFullYear()).toBe(2026);
    });

    it("handles month-end dates in leap years correctly", () => {
      const currentDate = new Date(2024, 0, 31); // Jan 31, 2024
      const nextDate = getNextDueDate(currentDate, "monthly", 1);
      // date-fns handles this by setting to last day of February (29th in leap year)
      expect(nextDate.getDate()).toBe(29);
      expect(nextDate.getMonth()).toBe(1); // February
      expect(nextDate.getFullYear()).toBe(2024);
    });

    it("handles 30th to 31-day month correctly", () => {
      const currentDate = new Date(2026, 3, 30); // Apr 30, 2026
      const nextDate = getNextDueDate(currentDate, "monthly", 1);
      expect(nextDate.getDate()).toBe(30);
      expect(nextDate.getMonth()).toBe(4); // May
      expect(nextDate.getFullYear()).toBe(2026);
    });
  });

  describe("yearly frequency", () => {
    it("adds 1 year when interval is 1", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "yearly", 1);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2027);
    });

    it("adds 2 years when interval is 2", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "yearly", 2);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2028);
    });

    it("adds 5 years when interval is 5", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "yearly", 5);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2031);
    });

    it("handles leap year to non-leap year correctly", () => {
      const currentDate = new Date(2024, 1, 29); // Feb 29, 2024
      const nextDate = getNextDueDate(currentDate, "yearly", 1);
      // date-fns handles this by setting to Feb 28th in non-leap years
      expect(nextDate.getDate()).toBe(28);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2025);
    });

    it("handles leap year to leap year correctly", () => {
      const currentDate = new Date(2024, 1, 29); // Feb 29, 2024
      const nextDate = getNextDueDate(currentDate, "yearly", 4);
      expect(nextDate.getDate()).toBe(29);
      expect(nextDate.getMonth()).toBe(1);
      expect(nextDate.getFullYear()).toBe(2028);
    });
  });

  describe("invalid or none frequency", () => {
    it("returns current date for 'none' frequency", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "none", 1);
      expect(nextDate).toBe(currentDate);
      expect(nextDate.getTime()).toBe(currentDate.getTime());
    });

    it("returns current date for invalid frequency", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "invalid", 1);
      expect(nextDate).toBe(currentDate);
      expect(nextDate.getTime()).toBe(currentDate.getTime());
    });

    it("returns current date for empty string frequency", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      const nextDate = getNextDueDate(currentDate, "", 1);
      expect(nextDate).toBe(currentDate);
      expect(nextDate.getTime()).toBe(currentDate.getTime());
    });

    it("returns current date for undefined frequency", () => {
      const currentDate = new Date(2026, 1, 15); // Feb 15, 2026
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextDate = getNextDueDate(currentDate, undefined as any, 1);
      expect(nextDate).toBe(currentDate);
      expect(nextDate.getTime()).toBe(currentDate.getTime());
    });
  });

  describe("preserves time information", () => {
    it("preserves hours, minutes, seconds, and milliseconds for daily", () => {
      const currentDate = new Date(2026, 1, 15, 14, 30, 45, 123);
      const nextDate = getNextDueDate(currentDate, "daily", 1);
      expect(nextDate.getHours()).toBe(14);
      expect(nextDate.getMinutes()).toBe(30);
      expect(nextDate.getSeconds()).toBe(45);
      expect(nextDate.getMilliseconds()).toBe(123);
    });

    it("preserves hours, minutes, seconds, and milliseconds for weekly", () => {
      const currentDate = new Date(2026, 1, 15, 9, 15, 30, 999);
      const nextDate = getNextDueDate(currentDate, "weekly", 1);
      expect(nextDate.getHours()).toBe(9);
      expect(nextDate.getMinutes()).toBe(15);
      expect(nextDate.getSeconds()).toBe(30);
      expect(nextDate.getMilliseconds()).toBe(999);
    });

    it("preserves hours, minutes, seconds, and milliseconds for monthly", () => {
      const currentDate = new Date(2026, 1, 15, 23, 59, 59, 500);
      const nextDate = getNextDueDate(currentDate, "monthly", 1);
      expect(nextDate.getHours()).toBe(23);
      expect(nextDate.getMinutes()).toBe(59);
      expect(nextDate.getSeconds()).toBe(59);
      expect(nextDate.getMilliseconds()).toBe(500);
    });

    it("preserves hours, minutes, seconds, and milliseconds for yearly", () => {
      const currentDate = new Date(2026, 1, 15, 12, 0, 0, 0);
      const nextDate = getNextDueDate(currentDate, "yearly", 1);
      expect(nextDate.getHours()).toBe(12);
      expect(nextDate.getMinutes()).toBe(0);
      expect(nextDate.getSeconds()).toBe(0);
      expect(nextDate.getMilliseconds()).toBe(0);
    });
  });
});
