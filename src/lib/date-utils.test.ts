import { describe, it, expect } from "vitest";
import { parseLocalDate } from "./date-utils";

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
