import { describe, it, expect } from "vitest";
import { isWithinQuietHours } from "./notification-scheduler";

describe("notification-scheduler", () => {
  const now = new Date("2026-02-15T10:00:00.000Z");

  describe("isWithinQuietHours", () => {
    it("should return false when quiet hours are disabled", () => {
      const result = isWithinQuietHours(
        now,
        false,
        "22:00",
        "08:00",
        "America/New_York",
      );
      expect(result).toBe(false);
    });

    it("should return true when time is within quiet hours (same day)", () => {
      const time = new Date("2026-02-15T23:00:00.000Z"); // 11 PM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "22:00",
        "08:00",
        "UTC",
      );
      expect(result).toBe(true);
    });

    it("should return false when time is outside quiet hours", () => {
      const time = new Date("2026-02-15T15:00:00.000Z"); // 3 PM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "22:00",
        "08:00",
        "UTC",
      );
      expect(result).toBe(false);
    });

    it("should handle quiet hours spanning midnight", () => {
      const time = new Date("2026-02-15T02:00:00.000Z"); // 2 AM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "22:00",
        "08:00",
        "UTC",
      );
      expect(result).toBe(true);
    });

    it("should handle quiet hours not spanning midnight", () => {
      const time = new Date("2026-02-15T14:00:00.000Z"); // 2 PM UTC
      const result = isWithinQuietHours(
        time,
        true,
        "12:00",
        "18:00",
        "UTC",
      );
      expect(result).toBe(true);
    });
  });
});
