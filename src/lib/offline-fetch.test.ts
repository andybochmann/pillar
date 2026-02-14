import { describe, it, expect, vi, beforeEach } from "vitest";
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
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/tasks?projectId=123", undefined);
  });

  it("passes through mutations when online and fetch succeeds", async () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    const mockResponse = new Response(JSON.stringify({ _id: "real-id" }), { status: 200 });
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
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });

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
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
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
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });

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
});
