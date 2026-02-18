import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimeTracking } from "./use-time-tracking";
import type { Task } from "@/types";

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

const { offlineFetch } = await import("@/lib/offline-fetch");

function makeMockTask(overrides: Partial<Task> = {}): Task {
  return {
    _id: "task-1",
    title: "Test Task",
    projectId: "proj-1",
    userId: "user-1",
    columnId: "todo",
    priority: "medium",
    order: 0,
    labels: [],
    subtasks: [],
    timeSessions: [],
    statusHistory: [],
    createdAt: "2026-02-14T00:00:00Z",
    updatedAt: "2026-02-14T00:00:00Z",
    ...overrides,
  };
}

describe("useTimeTracking", () => {
  const currentUserId = "user-1";
  const mockTasks = [
    makeMockTask({ _id: "task-1" }),
    makeMockTask({ _id: "task-2" }),
  ];

  const setTasks = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty set when no sessions are active", () => {
    const { result } = renderHook(() =>
      useTimeTracking(mockTasks, setTasks, currentUserId),
    );
    expect(result.current.activeTaskIds.size).toBe(0);
  });

  it("returns activeTaskIds for tasks with active sessions", () => {
    const tasksWithActive = [
      makeMockTask({
        _id: "task-1",
        timeSessions: [
          { _id: "s1", startedAt: "2026-02-14T09:00:00Z", endedAt: null, userId: "user-1" },
        ],
      }),
      makeMockTask({ _id: "task-2" }),
    ];

    const { result } = renderHook(() =>
      useTimeTracking(tasksWithActive, setTasks, currentUserId),
    );
    expect(result.current.activeTaskIds).toEqual(new Set(["task-1"]));
  });

  it("tracks multiple concurrent active sessions", () => {
    const tasksWithMultipleActive = [
      makeMockTask({
        _id: "task-1",
        timeSessions: [
          { _id: "s1", startedAt: "2026-02-14T09:00:00Z", endedAt: null, userId: "user-1" },
        ],
      }),
      makeMockTask({
        _id: "task-2",
        timeSessions: [
          { _id: "s2", startedAt: "2026-02-14T09:30:00Z", endedAt: null, userId: "user-1" },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      useTimeTracking(tasksWithMultipleActive, setTasks, currentUserId),
    );
    expect(result.current.activeTaskIds).toEqual(new Set(["task-1", "task-2"]));
  });

  it("ignores active sessions from other users", () => {
    const tasksWithOtherActive = [
      makeMockTask({
        _id: "task-1",
        timeSessions: [
          { _id: "s1", startedAt: "2026-02-14T09:00:00Z", endedAt: null, userId: "other-user" },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      useTimeTracking(tasksWithOtherActive, setTasks, currentUserId),
    );
    expect(result.current.activeTaskIds.size).toBe(0);
  });

  it("startTracking calls API and updates the started task", async () => {
    const updatedTask = makeMockTask({
      _id: "task-1",
      timeSessions: [
        { _id: "s1", startedAt: "2026-02-14T09:00:00Z", endedAt: null, userId: "user-1" },
      ],
    });

    vi.mocked(offlineFetch).mockResolvedValueOnce(
      new Response(JSON.stringify(updatedTask), { status: 200 }),
    );

    const { result } = renderHook(() =>
      useTimeTracking(mockTasks, setTasks, currentUserId),
    );

    await act(async () => {
      await result.current.startTracking("task-1");
    });

    expect(offlineFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/time-sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "start" }),
      }),
    );
    expect(setTasks).toHaveBeenCalled();
  });

  it("startTracking does not stop other active sessions", async () => {
    const alreadyActive = makeMockTask({
      _id: "task-1",
      timeSessions: [
        { _id: "s1", startedAt: "2026-02-14T09:00:00Z", endedAt: null, userId: "user-1" },
      ],
    });
    const updatedTask2 = makeMockTask({
      _id: "task-2",
      timeSessions: [
        { _id: "s2", startedAt: "2026-02-14T09:30:00Z", endedAt: null, userId: "user-1" },
      ],
    });

    vi.mocked(offlineFetch).mockResolvedValueOnce(
      new Response(JSON.stringify(updatedTask2), { status: 200 }),
    );

    let capturedUpdater: ((prev: Task[]) => Task[]) | null = null;
    const capturingSetTasks = vi.fn((updater: (prev: Task[]) => Task[]) => {
      capturedUpdater = updater;
    });

    const { result } = renderHook(() =>
      useTimeTracking([alreadyActive, makeMockTask({ _id: "task-2" })], capturingSetTasks, currentUserId),
    );

    await act(async () => {
      await result.current.startTracking("task-2");
    });

    // Apply the updater to verify task-1 session is NOT closed
    const nextTasks = capturedUpdater!([alreadyActive, makeMockTask({ _id: "task-2" })]);
    const task1After = nextTasks.find((t) => t._id === "task-1")!;
    expect(task1After.timeSessions[0].endedAt).toBeNull();
  });

  it("stopTracking calls API and updates tasks", async () => {
    const updatedTask = makeMockTask({
      _id: "task-1",
      timeSessions: [
        { _id: "s1", startedAt: "2026-02-14T09:00:00Z", endedAt: "2026-02-14T10:00:00Z", userId: "user-1" },
      ],
    });

    vi.mocked(offlineFetch).mockResolvedValueOnce(
      new Response(JSON.stringify(updatedTask), { status: 200 }),
    );

    const { result } = renderHook(() =>
      useTimeTracking(mockTasks, setTasks, currentUserId),
    );

    await act(async () => {
      await result.current.stopTracking("task-1");
    });

    expect(offlineFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/time-sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "stop" }),
      }),
    );
    expect(setTasks).toHaveBeenCalled();
  });

  it("deleteSession calls API and updates tasks", async () => {
    const updatedTask = makeMockTask({ _id: "task-1", timeSessions: [] });

    vi.mocked(offlineFetch).mockResolvedValueOnce(
      new Response(JSON.stringify(updatedTask), { status: 200 }),
    );

    const { result } = renderHook(() =>
      useTimeTracking(mockTasks, setTasks, currentUserId),
    );

    await act(async () => {
      await result.current.deleteSession("task-1", "s1");
    });

    expect(offlineFetch).toHaveBeenCalledWith(
      "/api/tasks/task-1/time-sessions/s1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(setTasks).toHaveBeenCalled();
  });

  it("throws on API error", async () => {
    vi.mocked(offlineFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 }),
    );

    const { result } = renderHook(() =>
      useTimeTracking(mockTasks, setTasks, currentUserId),
    );

    await expect(
      act(async () => {
        await result.current.startTracking("task-1");
      }),
    ).rejects.toThrow("Server error");
  });
});
