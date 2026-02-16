import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { canShareTasks, buildShareText, shareTask } from "./share-task";
import type { Priority } from "@/types";

describe("share-task", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe("canShareTasks", () => {
    it("returns true when navigator.share exists", () => {
      Object.defineProperty(global, "navigator", {
        value: { share: vi.fn() },
        writable: true,
        configurable: true,
      });
      expect(canShareTasks()).toBe(true);
    });

    it("returns false when navigator.share is undefined", () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(canShareTasks()).toBe(false);
    });
  });

  describe("buildShareText", () => {
    it("formats task with all fields", () => {
      const result = buildShareText({
        title: "Fix login bug",
        description: "Users cannot log in with SSO",
        priority: "high" as Priority,
        dueDate: "2026-03-01T00:00:00.000Z",
      });

      expect(result).toContain("Fix login bug");
      expect(result).toContain("Users cannot log in with SSO");
      expect(result).toContain("Priority: high");
      expect(result).toContain("Due:");
    });

    it("handles missing optional fields", () => {
      const result = buildShareText({
        title: "Simple task",
        priority: "medium" as Priority,
      });

      expect(result).toBe("Simple task\nPriority: medium");
      expect(result).not.toContain("Due:");
    });
  });

  describe("shareTask", () => {
    it("calls navigator.share with correct data", async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, "navigator", {
        value: { share: mockShare },
        writable: true,
        configurable: true,
      });

      const task = {
        title: "Test task",
        description: "A description",
        priority: "medium" as Priority,
      };

      const result = await shareTask(task);

      expect(result).toBe(true);
      expect(mockShare).toHaveBeenCalledWith({
        title: "Test task",
        text: buildShareText(task),
      });
    });

    it("returns false on AbortError (user cancelled)", async () => {
      const abortError = new Error("Share cancelled");
      abortError.name = "AbortError";
      const mockShare = vi.fn().mockRejectedValue(abortError);
      Object.defineProperty(global, "navigator", {
        value: { share: mockShare },
        writable: true,
        configurable: true,
      });

      const result = await shareTask({
        title: "Test",
        priority: "low" as Priority,
      });

      expect(result).toBe(false);
    });

    it("returns false when API not available", async () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
        configurable: true,
      });

      const result = await shareTask({
        title: "Test",
        priority: "low" as Priority,
      });

      expect(result).toBe(false);
    });

    it("re-throws non-AbortError errors", async () => {
      const mockShare = vi.fn().mockRejectedValue(new TypeError("Not allowed"));
      Object.defineProperty(global, "navigator", {
        value: { share: mockShare },
        writable: true,
        configurable: true,
      });

      await expect(
        shareTask({ title: "Test", priority: "low" as Priority }),
      ).rejects.toThrow("Not allowed");
    });
  });
});
