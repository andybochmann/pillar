import { describe, it, expect, afterEach } from "vitest";
import { isNativePlatform, getNativePlatform } from "./capacitor";

describe("capacitor utilities", () => {
  afterEach(() => {
    // Clean up any Capacitor mock on window
    delete (window as Record<string, unknown>).Capacitor;
  });

  describe("isNativePlatform", () => {
    it("returns false when Capacitor is not on window", () => {
      expect(isNativePlatform()).toBe(false);
    });

    it("returns true when Capacitor exists on window", () => {
      (window as Record<string, unknown>).Capacitor = {
        getPlatform: () => "android",
      };
      expect(isNativePlatform()).toBe(true);
    });
  });

  describe("getNativePlatform", () => {
    it("returns null when not in Capacitor", () => {
      expect(getNativePlatform()).toBeNull();
    });

    it("returns 'android' when running on Android", () => {
      (window as Record<string, unknown>).Capacitor = {
        getPlatform: () => "android",
      };
      expect(getNativePlatform()).toBe("android");
    });

    it("returns 'ios' when running on iOS", () => {
      (window as Record<string, unknown>).Capacitor = {
        getPlatform: () => "ios",
      };
      expect(getNativePlatform()).toBe("ios");
    });

    it("returns null for 'web' platform", () => {
      (window as Record<string, unknown>).Capacitor = {
        getPlatform: () => "web",
      };
      expect(getNativePlatform()).toBeNull();
    });
  });
});
