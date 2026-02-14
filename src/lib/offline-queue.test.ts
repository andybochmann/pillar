import { describe, it, expect, beforeEach } from "vitest";
import {
  addToQueue,
  getAllQueued,
  removeFromQueue,
  clearQueue,
  getQueueCount,
} from "./offline-queue";

describe("offline-queue", () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it("adds a mutation to the queue", async () => {
    const entry = await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "Test task" },
    });

    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.method).toBe("POST");
    expect(entry.url).toBe("/api/tasks");
    expect(entry.body).toEqual({ title: "Test task" });
  });

  it("retrieves all queued mutations sorted by timestamp", async () => {
    await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: { title: "First" },
    });
    // Small delay to ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 5));
    await addToQueue({
      method: "PATCH",
      url: "/api/tasks/123",
      body: { title: "Updated" },
    });
    await new Promise((r) => setTimeout(r, 5));
    await addToQueue({ method: "DELETE", url: "/api/tasks/456" });

    const all = await getAllQueued();
    expect(all).toHaveLength(3);
    expect(all[0].method).toBe("POST");
    expect(all[1].method).toBe("PATCH");
    expect(all[2].method).toBe("DELETE");
    // Sorted by timestamp ascending
    expect(all[0].timestamp).toBeLessThanOrEqual(all[1].timestamp);
    expect(all[1].timestamp).toBeLessThanOrEqual(all[2].timestamp);
  });

  it("removes a mutation by id", async () => {
    const entry = await addToQueue({
      method: "POST",
      url: "/api/tasks",
      body: {},
    });
    await addToQueue({ method: "DELETE", url: "/api/tasks/789" });

    await removeFromQueue(entry.id);

    const remaining = await getAllQueued();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].method).toBe("DELETE");
  });

  it("clears all queued mutations", async () => {
    await addToQueue({ method: "POST", url: "/api/tasks", body: {} });
    await addToQueue({ method: "POST", url: "/api/tasks", body: {} });

    await clearQueue();

    const all = await getAllQueued();
    expect(all).toHaveLength(0);
  });

  it("returns the queue count", async () => {
    expect(await getQueueCount()).toBe(0);
    await addToQueue({ method: "POST", url: "/api/tasks", body: {} });
    await addToQueue({ method: "PATCH", url: "/api/tasks/1", body: {} });
    expect(await getQueueCount()).toBe(2);
  });

  it("returns an empty array when queue is empty", async () => {
    const all = await getAllQueued();
    expect(all).toEqual([]);
  });
});
