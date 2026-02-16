import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./session-id", () => ({
  getSessionId: vi.fn(() => "test-session-id"),
}));

import { offlineFetch } from "./offline-fetch";
import { clearQueue, getAllQueued } from "./offline-queue";

describe("offlineFetch", () => {
  beforeEach(async () => {
    await clearQueue();
    vi.restoreAllMocks();
  });

  it("passes through GET requests", async () => {
    const mockResponse = new Response(JSON.stringify([]), { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const res = await offlineFetch("/api/tasks?projectId=123");
    expect(res).toBe(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/tasks?projectId=123",
      undefined,
    );
  });

  it("passes through mutations when online and fetch succeeds", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    const mockResponse = new Response(JSON.stringify({ _id: "real-id" }), {
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const res = await offlineFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Online task" }),
    });

    expect(res).toBe(mockResponse);
    const queued = await getAllQueued();
    expect(queued).toHaveLength(0);
  });

  it("queues mutations when offline and returns synthetic response", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const res = await offlineFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Offline task" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Offline task");
    expect(body._id).toMatch(/^offline-/);

    const queued = await getAllQueued();
    expect(queued).toHaveLength(1);
    expect(queued[0].method).toBe("POST");
    expect(queued[0].url).toBe("/api/tasks");
  });

  it("queues mutations when online but fetch fails", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const res = await offlineFetch("/api/tasks/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });

    expect(res.status).toBe(200);
    const queued = await getAllQueued();
    expect(queued).toHaveLength(1);
    expect(queued[0].method).toBe("PATCH");
  });

  it("returns empty body for offline DELETE", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const res = await offlineFetch("/api/tasks/42", {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBeUndefined();

    const queued = await getAllQueued();
    expect(queued).toHaveLength(1);
    expect(queued[0].method).toBe("DELETE");
  });

  it("injects X-Session-Id header on mutations", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    const mockResponse = new Response(JSON.stringify({ _id: "real-id" }), {
      status: 200,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    await offlineFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });

    const calledInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(calledInit.headers);
    expect(headers.get("X-Session-Id")).toBe("test-session-id");
  });

  it("does not inject X-Session-Id on GET requests", async () => {
    const mockResponse = new Response(JSON.stringify([]), { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    await offlineFetch("/api/tasks?projectId=123");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/tasks?projectId=123",
      undefined,
    );
  });

  describe("background sync registration", () => {
    it("registers background sync after queuing a mutation", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      const syncRegisterMock = vi.fn().mockResolvedValue(undefined);
      const readyPromise = Promise.resolve({
        sync: { register: syncRegisterMock },
      } as unknown as ServiceWorkerRegistration);

      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: readyPromise },
        writable: true,
        configurable: true,
      });

      await offlineFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Offline task" }),
      });

      // Wait for the async sync registration
      await readyPromise;
      // Allow microtask queue to flush
      await new Promise((r) => setTimeout(r, 0));

      expect(syncRegisterMock).toHaveBeenCalledWith("pillar-offline-sync");
    });

    it("does not throw when SyncManager is unavailable", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      const readyPromise = Promise.resolve(
        {} as ServiceWorkerRegistration,
      );

      Object.defineProperty(navigator, "serviceWorker", {
        value: { ready: readyPromise },
        writable: true,
        configurable: true,
      });

      // Should not throw even when sync is undefined
      await expect(
        offlineFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title: "No sync" }),
        }),
      ).resolves.toBeDefined();
    });

    it("does not throw when serviceWorker is unavailable", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      await expect(
        offlineFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title: "No SW" }),
        }),
      ).resolves.toBeDefined();
    });
  });
});
