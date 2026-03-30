import { describe, it, expect, beforeEach } from "vitest";
import { getLastUsedProject, setLastUsedProject } from "./last-used-project";

describe("last-used-project", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no project has been set", () => {
    expect(getLastUsedProject()).toBeNull();
  });

  it("stores and retrieves a project ID", () => {
    setLastUsedProject("abc123");
    expect(getLastUsedProject()).toBe("abc123");
  });

  it("overwrites previous value", () => {
    setLastUsedProject("first");
    setLastUsedProject("second");
    expect(getLastUsedProject()).toBe("second");
  });
});
