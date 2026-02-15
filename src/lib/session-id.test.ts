import { describe, it, expect, beforeEach, vi } from "vitest";

describe("session-id", () => {
  beforeEach(() => {
    // Reset module state between tests by re-importing
    vi.resetModules();
  });

  it("returns a string UUID", async () => {
    const { getSessionId } = await import("./session-id");
    const id = getSessionId();
    expect(typeof id).toBe("string");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns the same ID on repeated calls within the same module instance", async () => {
    const { getSessionId } = await import("./session-id");
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
  });

  it("returns a different ID after module reset (simulating new tab)", async () => {
    const { getSessionId: getFirst } = await import("./session-id");
    const id1 = getFirst();

    vi.resetModules();

    const { getSessionId: getSecond } = await import("./session-id");
    const id2 = getSecond();

    expect(id1).not.toBe(id2);
  });
});
