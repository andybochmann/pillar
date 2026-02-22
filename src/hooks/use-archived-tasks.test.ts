import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useArchivedTasks } from "./use-archived-tasks";
import type { Task } from "@/types";

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

const mockArchivedTask: Task = {
  _id: "task-1",
  title: "Archived Task",
  projectId: "proj-1",
  userId: "u1",
  columnId: "todo",
  priority: "medium",
  order: 0,
  labels: [],
  subtasks: [],
  statusHistory: [],
  timeSessions: [],
  archived: true,
  archivedAt: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

const mockArchivedTask2: Task = {
  _id: "task-2",
  title: "Another Archived Task",
  projectId: "proj-1",
  userId: "u1",
  columnId: "done",
  priority: "high",
  order: 1,
  labels: [],
  subtasks: [],
  statusHistory: [],
  timeSessions: [],
  archived: true,
  archivedAt: "2026-02-10T00:00:00.000Z",
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-02-10T00:00:00.000Z",
};

describe("useArchivedTasks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useArchivedTasks());
    expect(result.current.archivedTasks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe("fetchArchived", () => {
    it("fetches archived tasks for a project", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockArchivedTask, mockArchivedTask2]),
      } as Response);

      const { result } = renderHook(() => useArchivedTasks());

      await act(async () => {
        await result.current.fetchArchived("proj-1");
      });

      expect(result.current.archivedTasks).toHaveLength(2);
      expect(result.current.archivedTasks[0].title).toBe("Archived Task");
      expect(result.current.archivedTasks[1].title).toBe(
        "Another Archived Task",
      );
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/tasks?projectId=proj-1&archived=true",
      );
    });

    it("handles fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Project not found" }),
      } as Response);

      const { result } = renderHook(() => useArchivedTasks());

      await act(async () => {
        await result.current.fetchArchived("proj-1");
      });

      expect(result.current.archivedTasks).toEqual([]);
      expect(result.current.error).toBe("Project not found");
      expect(result.current.loading).toBe(false);
    });

    it("sets loading state during fetch", async () => {
      let resolvePromise: (value: unknown) => void;
      const responsePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(global.fetch).mockReturnValueOnce(
        responsePromise as Promise<Response>,
      );

      const { result } = renderHook(() => useArchivedTasks());

      const fetchPromise = act(async () => {
        const promise = result.current.fetchArchived("proj-1");
        return promise;
      });

      // After resolving, loading should be false
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetchPromise;
      expect(result.current.loading).toBe(false);
    });
  });

  describe("unarchiveTask", () => {
    it("unarchives a task and removes it from the list", async () => {
      // First populate with archived tasks
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockArchivedTask, mockArchivedTask2]),
      } as Response);

      const { result } = renderHook(() => useArchivedTasks());

      await act(async () => {
        await result.current.fetchArchived("proj-1");
      });
      expect(result.current.archivedTasks).toHaveLength(2);

      // Now unarchive
      const { offlineFetch } = await import("@/lib/offline-fetch");
      vi.mocked(offlineFetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockArchivedTask, archived: false, archivedAt: null }),
      } as Response);

      await act(async () => {
        await result.current.unarchiveTask("task-1");
      });

      expect(result.current.archivedTasks).toHaveLength(1);
      expect(result.current.archivedTasks[0]._id).toBe("task-2");
      expect(offlineFetch).toHaveBeenCalledWith("/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
    });

    it("throws on unarchive failure", async () => {
      const { offlineFetch } = await import("@/lib/offline-fetch");
      vi.mocked(offlineFetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Task not found" }),
      } as Response);

      const { result } = renderHook(() => useArchivedTasks());

      await expect(
        act(() => result.current.unarchiveTask("task-999")),
      ).rejects.toThrow("Task not found");
    });
  });

  describe("permanentDeleteTask", () => {
    it("permanently deletes a task and removes it from the list", async () => {
      // First populate with archived tasks
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockArchivedTask, mockArchivedTask2]),
      } as Response);

      const { result } = renderHook(() => useArchivedTasks());

      await act(async () => {
        await result.current.fetchArchived("proj-1");
      });
      expect(result.current.archivedTasks).toHaveLength(2);

      // Now delete permanently
      const { offlineFetch } = await import("@/lib/offline-fetch");
      vi.mocked(offlineFetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await act(async () => {
        await result.current.permanentDeleteTask("task-1");
      });

      expect(result.current.archivedTasks).toHaveLength(1);
      expect(result.current.archivedTasks[0]._id).toBe("task-2");
      expect(offlineFetch).toHaveBeenCalledWith("/api/tasks/task-1", {
        method: "DELETE",
      });
    });

    it("throws on permanent delete failure", async () => {
      const { offlineFetch } = await import("@/lib/offline-fetch");
      vi.mocked(offlineFetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Failed to delete task" }),
      } as Response);

      const { result } = renderHook(() => useArchivedTasks());

      await expect(
        act(() => result.current.permanentDeleteTask("task-999")),
      ).rejects.toThrow("Failed to delete task");
    });
  });
});
