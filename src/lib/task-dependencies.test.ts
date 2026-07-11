import { describe, it, expect } from "vitest";
import {
  isBlockerOpen,
  getBlockerStatus,
  hasCycle,
  wouldCreateCycle,
  type BlockerCompletionState,
} from "./task-dependencies";

describe("isBlockerOpen", () => {
  it("is open when neither completed nor archived", () => {
    expect(isBlockerOpen({})).toBe(true);
    expect(isBlockerOpen({ completedAt: null, archived: false })).toBe(true);
  });

  it("is closed when completed", () => {
    expect(isBlockerOpen({ completedAt: "2026-01-01T00:00:00Z" })).toBe(false);
    expect(isBlockerOpen({ completedAt: new Date() })).toBe(false);
  });

  it("is closed when archived", () => {
    expect(isBlockerOpen({ archived: true })).toBe(false);
  });
});

describe("getBlockerStatus", () => {
  const map = new Map<string, BlockerCompletionState>([
    ["a", { completedAt: null }], // open
    ["b", { completedAt: "2026-01-01T00:00:00Z" }], // done
    ["c", { archived: true }], // archived → closed
    ["d", { completedAt: null }], // open
  ]);

  it("counts only known, open blockers", () => {
    expect(getBlockerStatus(["a", "b", "c", "d"], map)).toEqual({
      openCount: 2,
      hasUnknown: false,
    });
  });

  it("flags unknown blockers not present in the map", () => {
    expect(getBlockerStatus(["a", "missing"], map)).toEqual({
      openCount: 1,
      hasUnknown: true,
    });
  });

  it("handles empty / undefined blockedBy", () => {
    expect(getBlockerStatus([], map)).toEqual({ openCount: 0, hasUnknown: false });
    expect(getBlockerStatus(undefined, map)).toEqual({
      openCount: 0,
      hasUnknown: false,
    });
  });

  it("treats all as unknown when the map is empty", () => {
    expect(getBlockerStatus(["x", "y"], new Map())).toEqual({
      openCount: 0,
      hasUnknown: true,
    });
  });
});

describe("hasCycle", () => {
  it("returns false for an empty graph", () => {
    expect(hasCycle(new Map())).toBe(false);
  });

  it("returns false for a valid chain a→b→c", () => {
    const adj = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", []],
    ]);
    expect(hasCycle(adj)).toBe(false);
  });

  it("detects a direct 2-node cycle a→b→a", () => {
    const adj = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    expect(hasCycle(adj)).toBe(true);
  });

  it("detects a self-loop", () => {
    const adj = new Map<string, string[]>([["a", ["a"]]]);
    expect(hasCycle(adj)).toBe(true);
  });

  it("detects a transitive cycle a→b→c→a", () => {
    const adj = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
    ]);
    expect(hasCycle(adj)).toBe(true);
  });

  it("ignores edges to leaf nodes not present as keys", () => {
    const adj = new Map<string, string[]>([["a", ["ghost"]]]);
    expect(hasCycle(adj)).toBe(false);
  });

  it("handles a diamond (shared dependency) without false positives", () => {
    const adj = new Map<string, string[]>([
      ["a", ["b", "c"]],
      ["b", ["d"]],
      ["c", ["d"]],
      ["d", []],
    ]);
    expect(hasCycle(adj)).toBe(false);
  });
});

describe("wouldCreateCycle", () => {
  const tasks = [
    { _id: "a", blockedBy: [] as string[] },
    { _id: "b", blockedBy: ["a"] }, // b blocked by a
    { _id: "c", blockedBy: ["b"] }, // c blocked by b
  ];

  it("rejects a self-dependency", () => {
    expect(wouldCreateCycle("a", ["a"], tasks)).toBe(true);
  });

  it("rejects a direct cycle (a blocked by b, b already blocked by a)", () => {
    // b → a exists; adding a → b closes the loop
    expect(wouldCreateCycle("a", ["b"], tasks)).toBe(true);
  });

  it("rejects a transitive cycle (a blocked by c, chain c→b→a)", () => {
    // c → b → a exists; adding a → c closes the loop
    expect(wouldCreateCycle("a", ["c"], tasks)).toBe(true);
  });

  it("allows a valid new dependency", () => {
    // a depends on nothing yet; making c blocked by a is fine (a has no deps)
    expect(wouldCreateCycle("c", ["a"], tasks)).toBe(false);
  });

  it("allows adding a fresh unrelated blocker", () => {
    const extended = [...tasks, { _id: "d", blockedBy: [] as string[] }];
    expect(wouldCreateCycle("a", ["d"], extended)).toBe(false);
  });

  it("handles a target task absent from the task list", () => {
    expect(wouldCreateCycle("new", ["a"], tasks)).toBe(false);
    expect(wouldCreateCycle("new", ["new"], tasks)).toBe(true);
  });

  it("detects a cycle formed by multiple proposed blockers", () => {
    // Adding both b and c: c → b → a, so a → c closes a loop
    expect(wouldCreateCycle("a", ["b", "c"], tasks)).toBe(true);
  });
});
