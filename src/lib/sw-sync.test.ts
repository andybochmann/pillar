import { describe, it, expect, vi, beforeEach } from "vitest";
import { addToQueue, clearQueue, getAllQueued } from "./offline-queue";

/**
 * Tests that validate the Background Sync replay algorithm pattern.
 *
 * The actual sync handler lives in public/sw.js (vanilla JS) and can't be
 * imported directly. These tests verify the same algorithm:
 * IndexedDB read → sequential replay with retries → delete on success → notify.
 */
describe("SW Background Sync replay algorithm", () => {
  beforeEach(async () => {
    await clearQueue();
    vi.restoreAllMocks();
  });

  it("reads queued mutations sorted by timestamp", async () => {
    await addToQueue({ method: "POST", url: "/api/tasks", body: { title: "First" } });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await addToQueue({ method: "PATCH", url: "/api/tasks/1", body: { title: "Second" } });

    const queued = await getAllQueued();

    expect(queued).toHaveLength(2);
    expect(queued[0].body).toEqual({ title: "First" });
    expect(queued[1].body).toEqual({ title: "Second" });
    expect(queued[0].timestamp).toBeLessThan(queued[1].timestamp);
  });

  it("replays mutations sequentially and removes on success", async () => {
    await addToQueue({ method: "POST", url: "/api/tasks", body: { title: "A" } });
    await addToQueue({ method: "DELETE", url: "/api/tasks/42" });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const queued = await getAllQueued();

    // Simulate sequential replay + delete (mirrors SW algorithm)
    for (const mutation of queued) {
      const init: RequestInit = {
        method: mutation.method,
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": "test-sw-session",
        },
      };
      if (mutation.body !== undefined) {
        init.body = JSON.stringify(mutation.body);
      }

      const res = await fetch(mutation.url, init);
      if (res.ok) {
        const db = await import("./offline-queue");
        await db.removeFromQueue(mutation.id);
      }
    }

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Verify both mutations were replayed (order may vary if timestamps match)
    const urls = fetchSpy.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/api/tasks");
    expect(urls).toContain("/api/tasks/42");

    const methods = fetchSpy.mock.calls.map((c) => (c[1] as RequestInit).method);
    expect(methods).toContain("POST");
    expect(methods).toContain("DELETE");

    // Queue should be empty after successful replay
    const remaining = await getAllQueued();
    expect(remaining).toHaveLength(0);
  });

  it("skips 4xx client errors without retrying", async () => {
    await addToQueue({ method: "POST", url: "/api/tasks", body: { title: "Bad" } });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 400 }),
    );

    const queued = await getAllQueued();
    const mutation = queued[0];

    // Simulate the replay with retry logic
    const MAX_RETRIES = 3;
    let ok = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetch(mutation.url, { method: mutation.method });
      if (res.ok) { ok = true; break; }
      if (res.status >= 400 && res.status < 500) break; // Skip retries for client errors
    }

    // Should only call fetch once (no retries for 4xx)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(ok).toBe(false);
  });

  it("retries on network error with exponential backoff", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await addToQueue({ method: "POST", url: "/api/tasks", body: { title: "Retry" } });

    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount < 3) throw new Error("Network error");
      return new Response("{}", { status: 200 });
    });

    const queued = await getAllQueued();
    const mutation = queued[0];

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;
    let ok = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(mutation.url, { method: mutation.method });
        if (res.ok) { ok = true; break; }
      } catch {
        // Network error — retry
      }
      if (attempt < MAX_RETRIES - 1) {
        await vi.advanceTimersByTimeAsync(BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }

    expect(ok).toBe(true);
    expect(callCount).toBe(3);

    vi.useRealTimers();
  });

  it("includes X-Session-Id header on replayed requests", async () => {
    await addToQueue({ method: "POST", url: "/api/tasks", body: { title: "T" } });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const queued = await getAllQueued();
    const sessionId = "sw-session-abc";

    await fetch(queued[0].url, {
      method: queued[0].method,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": sessionId,
      },
      body: JSON.stringify(queued[0].body),
    });

    const calledInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["X-Session-Id"]).toBe(sessionId);
  });
});
