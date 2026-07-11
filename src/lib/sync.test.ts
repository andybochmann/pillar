import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./session-id", () => ({
  getSessionId: vi.fn(() => "test-session-id"),
}));

import { replayQueue } from "./sync";
import { addToQueue, clearQueue, getAllQueued } from "./offline-queue";

/**
 * Build a Response whose `url` is set (real fetch populates this; the Response
 * constructor leaves it empty). The replayer uses `res.url` to detect auth
 * redirects, so tests must provide a same-origin /api/ url.
 */
function apiResponse(
  body: unknown,
  init: { status?: number; url?: string; redirected?: boolean } = {},
): Response {
  const res = new Response(JSON.stringify(body), { status: init.status ?? 200 });
  Object.defineProperty(res, "url", {
    value: init.url ?? "http://localhost/api/tasks",
    configurable: true,
  });
  if (init.redirected) {
    Object.defineProperty(res, "redirected", {
      value: true,
      configurable: true,
    });
  }
  return res;
}

describe("sync", () => {
  beforeEach(async () => {
    await clearQueue();
    vi.restoreAllMocks();
  });

  it("replays queued mutations and removes successful ones", async () => {
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "A" },
    });
    await addToQueue({
      method: "PATCH",
      url: "/api/tasks/1",
      body: { title: "B" },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(apiResponse({ ok: true }));

    const result = await replayQueue();

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const remaining = await getAllQueued();
    expect(remaining).toHaveLength(0);
  });

  it("keeps failed mutations in the queue", async () => {
    await addToQueue({ method: "DELETE", url: "/api/tasks/999" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      apiResponse({ error: "Server error" }, { status: 500, url: "http://localhost/api/tasks/999" }),
    );

    const result = await replayQueue();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);

    const remaining = await getAllQueued();
    expect(remaining).toHaveLength(1);
  });

  it("does not retry on 4xx errors", async () => {
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "Bad" },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(apiResponse({ error: "Bad request" }, { status: 400 }));

    const result = await replayQueue();

    expect(result.failed).toBe(1);
    expect(result.permanentFailures).toBe(1);
    // Should only call fetch once (no retries for 4xx)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries on network errors with backoff", async () => {
    await addToQueue({
      method: "PATCH",
      url: "/api/tasks/1",
      body: { title: "X" },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(apiResponse({}, { url: "http://localhost/api/tasks/1" }));

    const result = await replayQueue();

    expect(result.succeeded).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("returns zero counts when queue is empty", async () => {
    const result = await replayQueue();
    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      permanentFailures: 0,
      authRequired: false,
    });
  });

  it("includes X-Session-Id header in replayed requests", async () => {
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "Test" },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(apiResponse({}));

    await replayQueue();

    const calledInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["X-Session-Id"]).toBe("test-session-id");
  });

  it("keeps the queue and flags auth when a mutation is redirected to login", async () => {
    await addToQueue({ method: "POST", url: "/api/tasks", body: { title: "A" } });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      // Simulate middleware 302 → browser follows to the login page
      apiResponse("<html>login</html>", {
        status: 200,
        url: "http://localhost/login",
        redirected: true,
      }),
    );

    const result = await replayQueue();

    expect(result.authRequired).toBe(true);
    expect(result.succeeded).toBe(0);
    // Mutation must remain queued for retry after re-login
    const remaining = await getAllQueued();
    expect(remaining).toHaveLength(1);
  });

  it("rewrites offline temp ids in later mutations after a create replays", async () => {
    // Offline POST that created a task with a temp id
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "Created offline" },
      tempId: "offline-abc",
    });
    // Later PATCH that references the temp id in its URL
    await addToQueue({
      method: "PATCH",
      url: "/api/tasks/offline-abc",
      body: { title: "Edited" },
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/api/tasks")) {
          return apiResponse({ _id: "real-123" }, { url: "http://localhost/api/tasks" });
        }
        return apiResponse({}, { url: "http://localhost" + new URL(url, "http://localhost").pathname });
      },
    );

    const result = await replayQueue();

    expect(result.succeeded).toBe(2);
    // The PATCH must have been rewritten to the real id
    const patchUrl = String(fetchSpy.mock.calls[1][0]);
    expect(patchUrl).toContain("/api/tasks/real-123");
    expect(patchUrl).not.toContain("offline-abc");
  });
});
