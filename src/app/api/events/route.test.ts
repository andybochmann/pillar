import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncEventBus, type SyncEvent } from "@/lib/event-bus";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

import { GET } from "./route";

describe("GET /api/events", () => {
  beforeEach(() => {
    syncEventBus.removeAllListeners();
  });

  afterEach(() => {
    syncEventBus.removeAllListeners();
  });

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/events?sessionId=abc");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns SSE content-type headers", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/events?sessionId=abc", {
      signal: controller.signal,
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    controller.abort();
  });

  it("streams sync events filtered by userId", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/events?sessionId=abc", {
      signal: controller.signal,
    });

    const response = await GET(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read the initial connection message
    const { value: initial } = await reader.read();
    const initialText = decoder.decode(initial);
    expect(initialText).toContain(": connected");

    // Emit an event for our user
    const event: SyncEvent = {
      entity: "task",
      action: "created",
      userId: session.user.id,
      sessionId: "other-session",
      entityId: "task-1",
      data: { title: "Test" },
      timestamp: Date.now(),
    };
    syncEventBus.emit("sync", event);

    // Wait briefly for async stream write
    await new Promise((r) => setTimeout(r, 10));

    const { value } = await reader.read();
    const text = decoder.decode(value);
    expect(text).toContain("event: sync");
    expect(text).toContain('"entity":"task"');
    expect(text).toContain('"action":"created"');

    controller.abort();
  });

  it("skips events from same sessionId", async () => {
    const controller = new AbortController();
    const request = new Request(
      "http://localhost/api/events?sessionId=my-session",
      { signal: controller.signal },
    );

    const response = await GET(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial connection message
    await reader.read();

    // Emit an event from our own session
    syncEventBus.emit("sync", {
      entity: "task",
      action: "created",
      userId: session.user.id,
      sessionId: "my-session",
      entityId: "task-1",
      timestamp: Date.now(),
    } satisfies SyncEvent);

    // Emit an event from a different session
    syncEventBus.emit("sync", {
      entity: "project",
      action: "updated",
      userId: session.user.id,
      sessionId: "other-session",
      entityId: "project-1",
      timestamp: Date.now(),
    } satisfies SyncEvent);

    await new Promise((r) => setTimeout(r, 10));

    const { value } = await reader.read();
    const text = decoder.decode(value);
    // Should receive the project event but not the task event (same session)
    expect(text).toContain('"entity":"project"');
    expect(text).not.toContain('"entity":"task"');

    controller.abort();
  });

  it("skips events for different users", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/events?sessionId=abc", {
      signal: controller.signal,
    });

    const response = await GET(request);
    const reader = response.body!.getReader();

    // Read initial connection message
    await reader.read();

    // Emit an event for a different user
    syncEventBus.emit("sync", {
      entity: "task",
      action: "created",
      userId: "different-user-id",
      sessionId: "other-session",
      entityId: "task-1",
      timestamp: Date.now(),
    } satisfies SyncEvent);

    // Emit an event for our user
    syncEventBus.emit("sync", {
      entity: "project",
      action: "created",
      userId: session.user.id,
      sessionId: "other-session",
      entityId: "project-1",
      timestamp: Date.now(),
    } satisfies SyncEvent);

    await new Promise((r) => setTimeout(r, 10));

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"entity":"project"');
    expect(text).not.toContain('"entity":"task"');

    controller.abort();
  });

  it("cleans up listener on abort", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/events?sessionId=abc", {
      signal: controller.signal,
    });

    const listenersBefore = syncEventBus.listenerCount("sync");
    await GET(request);
    const listenersAfter = syncEventBus.listenerCount("sync");
    expect(listenersAfter).toBe(listenersBefore + 1);

    controller.abort();

    // Wait for abort to propagate
    await new Promise((r) => setTimeout(r, 10));

    const listenersAfterAbort = syncEventBus.listenerCount("sync");
    expect(listenersAfterAbort).toBe(listenersBefore);
  });
});
