import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./session-id", () => ({
  getSessionId: vi.fn(() => "test-session-id"),
}));

import { replayQueue } from "./sync";
import { addToQueue, clearQueue, getAllQueued } from "./offline-queue";

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
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

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
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 }),
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
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }),
      );

    const result = await replayQueue();

    expect(result.failed).toBe(1);
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
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    const result = await replayQueue();

    expect(result.succeeded).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("returns zero counts when queue is empty", async () => {
    const result = await replayQueue();
    expect(result).toEqual({ total: 0, succeeded: 0, failed: 0 });
  });

  it("includes X-Session-Id header in replayed requests", async () => {
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "Test" },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      );

    await replayQueue();

    const calledInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["X-Session-Id"]).toBe("test-session-id");
  });
});
