import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { SyncEvent } from "@/lib/event-bus";
import { useTasks } from "./use-tasks";

const mockTasks = [
  {
    _id: "task-1",
    title: "Fix login bug",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "high" as const,
    order: 0,
    labels: [],
    subtasks: [],
    statusHistory: [],
    timeSessions: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "task-2",
    title: "Write tests",
    projectId: "proj-1",
    userId: "u1",
    columnId: "todo",
    priority: "medium" as const,
    order: 1,
    labels: ["lbl-testing"],
    subtasks: [],
    statusHistory: [],
    timeSessions: [],
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useTasks", () => {
  it("initializes with provided tasks", () => {
    const { result } = renderHook(() => useTasks(mockTasks));
    expect(result.current.tasks).toEqual(mockTasks);
    expect(result.current.loading).toBe(false);
  });

  it("initializes empty when no tasks provided", () => {
    const { result } = renderHook(() => useTasks());
    expect(result.current.tasks).toEqual([]);
  });

  it("fetches tasks by projectId", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockTasks,
    } as Response);

    const { result } = renderHook(() => useTasks());

    await act(async () => {
      await result.current.fetchTasks("proj-1");
    });

    expect(result.current.tasks).toEqual(mockTasks);
    expect(global.fetch).toHaveBeenCalledWith("/api/tasks?projectId=proj-1");
  });

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as Response);

    const { result } = renderHook(() => useTasks());

    await act(async () => {
      await result.current.fetchTasks("proj-1");
    });

    expect(result.current.error).toBe("Not found");
  });

  it("creates a task and adds to list", async () => {
    const newTask = {
      _id: "task-3",
      title: "New task",
      projectId: "proj-1",
      userId: "u1",
      columnId: "todo",
      priority: "medium" as const,
      order: 2,
      labels: [],
      timeSessions: [],
      createdAt: "",
      updatedAt: "",
    };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => newTask,
    } as Response);

    const { result } = renderHook(() => useTasks(mockTasks));

    await act(async () => {
      await result.current.createTask({
        title: "New task",
        projectId: "proj-1",
        columnId: "todo",
      });
    });

    expect(result.current.tasks).toHaveLength(3);
  });

  it("updates a task in the list", async () => {
    const updated = { ...mockTasks[0], title: "Updated title" };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const { result } = renderHook(() => useTasks(mockTasks));

    await act(async () => {
      await result.current.updateTask("task-1", { title: "Updated title" });
    });

    expect(result.current.tasks[0].title).toBe("Updated title");
  });

  it("deletes a task from the list", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const { result } = renderHook(() => useTasks(mockTasks));

    await act(async () => {
      await result.current.deleteTask("task-1");
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]._id).toBe("task-2");
  });

  it("throws on create failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Title is required" }),
    } as Response);

    const { result } = renderHook(() => useTasks());

    await expect(
      act(() =>
        result.current.createTask({
          title: "",
          projectId: "proj-1",
          columnId: "todo",
        }),
      ),
    ).rejects.toThrow("Title is required");
  });

  it("updates subtasks on a task", async () => {
    const updatedSubtasks = [
      { _id: "s1", title: "Do thing", completed: true },
    ];
    const updated = { ...mockTasks[0], subtasks: updatedSubtasks };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const { result } = renderHook(() => useTasks(mockTasks));

    await act(async () => {
      await result.current.updateTask("task-1", {
        subtasks: updatedSubtasks,
      });
    });

    expect(result.current.tasks[0].subtasks).toEqual(updatedSubtasks);
  });

  it("allows direct setTasks for optimistic updates", () => {
    const { result } = renderHook(() => useTasks(mockTasks));

    act(() => {
      result.current.setTasks((prev) =>
        prev.map((t) => (t._id === "task-1" ? { ...t, columnId: "done" } : t)),
      );
    });

    expect(result.current.tasks[0].columnId).toBe("done");
  });

  describe("sync subscription", () => {
    function emitSync(detail: Partial<SyncEvent>) {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", { detail }),
      );
    }

    it("adds a task on created event matching projectId", () => {
      const { result } = renderHook(() =>
        useTasks(mockTasks, "proj-1"),
      );

      const newTask = {
        _id: "task-new",
        title: "Synced task",
        projectId: "proj-1",
        userId: "u1",
        columnId: "todo",
        priority: "low",
        order: 5,
        labels: [],
        subtasks: [],
        statusHistory: [],
        timeSessions: [],
        createdAt: "",
        updatedAt: "",
      };

      act(() => {
        emitSync({
          entity: "task",
          action: "created",
          entityId: "task-new",
          projectId: "proj-1",
          data: newTask,
        });
      });

      expect(result.current.tasks).toHaveLength(3);
      expect(result.current.tasks[2]._id).toBe("task-new");
    });

    it("does not add a task for a different projectId", () => {
      const { result } = renderHook(() =>
        useTasks(mockTasks, "proj-1"),
      );

      act(() => {
        emitSync({
          entity: "task",
          action: "created",
          entityId: "task-other",
          projectId: "proj-2",
          data: { _id: "task-other", projectId: "proj-2" },
        });
      });

      expect(result.current.tasks).toHaveLength(2);
    });

    it("updates a task on updated event", () => {
      const { result } = renderHook(() =>
        useTasks(mockTasks, "proj-1"),
      );

      act(() => {
        emitSync({
          entity: "task",
          action: "updated",
          entityId: "task-1",
          projectId: "proj-1",
          data: { ...mockTasks[0], title: "Updated via sync" },
        });
      });

      expect(result.current.tasks[0].title).toBe("Updated via sync");
    });

    it("removes a task on deleted event", () => {
      const { result } = renderHook(() =>
        useTasks(mockTasks, "proj-1"),
      );

      act(() => {
        emitSync({
          entity: "task",
          action: "deleted",
          entityId: "task-1",
          projectId: "proj-1",
        });
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]._id).toBe("task-2");
    });

    it("does not add duplicate tasks", () => {
      const { result } = renderHook(() =>
        useTasks(mockTasks, "proj-1"),
      );

      act(() => {
        emitSync({
          entity: "task",
          action: "created",
          entityId: "task-1",
          projectId: "proj-1",
          data: mockTasks[0],
        });
      });

      expect(result.current.tasks).toHaveLength(2);
    });

    it("refetches on reordered event", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockTasks,
      } as Response);

      const { result } = renderHook(() =>
        useTasks(mockTasks, "proj-1"),
      );

      await act(async () => {
        emitSync({
          entity: "task",
          action: "reordered",
          entityId: "",
        });
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/tasks?projectId=proj-1",
      );
    });

    it("refetches on pillar:reconnected event", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockTasks,
      } as Response);

      renderHook(() => useTasks(mockTasks, "proj-1"));

      await act(async () => {
        window.dispatchEvent(new CustomEvent("pillar:reconnected"));
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/tasks?projectId=proj-1",
      );
    });

    it("refetches on pillar:sync-complete event", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockTasks,
      } as Response);

      renderHook(() => useTasks(mockTasks, "proj-1"));

      await act(async () => {
        window.dispatchEvent(new CustomEvent("pillar:sync-complete"));
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/tasks?projectId=proj-1",
      );
    });
  });
});
