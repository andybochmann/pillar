import { describe, it, expect } from "vitest";
import { getCompletionForColumnChange } from "./column-completion";
import type { Column } from "@/types";

const columns: Column[] = [
  { id: "todo", name: "To Do", order: 0 },
  { id: "in-progress", name: "In Progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];

describe("getCompletionForColumnChange", () => {
  it("returns completedAt when moving to the last column", () => {
    const result = getCompletionForColumnChange("todo", "done", columns);
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    // Verify it's a valid ISO date
    expect(new Date(result!).toISOString()).toBe(result);
  });

  it("returns null when moving away from the last column", () => {
    const result = getCompletionForColumnChange("done", "todo", columns);
    expect(result).toBeNull();
  });

  it("returns undefined when moving between non-last columns", () => {
    const result = getCompletionForColumnChange("todo", "in-progress", columns);
    expect(result).toBeUndefined();
  });

  it("returns undefined when columns are the same", () => {
    const result = getCompletionForColumnChange("todo", "todo", columns);
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty columns array", () => {
    const result = getCompletionForColumnChange("todo", "done", []);
    expect(result).toBeUndefined();
  });

  it("handles unsorted columns by sorting by order", () => {
    const unsorted: Column[] = [
      { id: "done", name: "Done", order: 2 },
      { id: "todo", name: "To Do", order: 0 },
      { id: "in-progress", name: "In Progress", order: 1 },
    ];
    const result = getCompletionForColumnChange("todo", "done", unsorted);
    expect(typeof result).toBe("string");
  });

  it("returns completedAt when moving from middle to last", () => {
    const result = getCompletionForColumnChange("in-progress", "done", columns);
    expect(typeof result).toBe("string");
  });

  it("returns null when moving from last to middle", () => {
    const result = getCompletionForColumnChange("done", "in-progress", columns);
    expect(result).toBeNull();
  });
});
