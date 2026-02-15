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

  it("returns null activeTaskId when no sessions are active", () => {
    const { result } = renderHook(() =>
      useTimeTracking(mockTasks, setTasks, currentUserId),
    );
    expect(result.current.activeTaskId).toBeNull();
  });

  it("returns activeTaskId for task with active session", () => {
    const tasksWithActive = [
      makeMockTask({
        _id: "task-1",
        timeSessions: [
          {
            _id: "s1",
            startedAt: "2026-02-14T09:00:00Z",
            endedAt: null,
            userId: "user-1",
          },
        ],
      }),
      makeMockTask({ _id: "task-2" }),
    ];

    const { result } = renderHook(() =>
      useTimeTracking(tasksWithActive, setTasks, currentUserId),
    );
    expect(result.current.activeTaskId).toBe("task-1");
  });

  it("ignores active sessions from other users", () => {
    const tasksWithOtherActive = [
      makeMockTask({
        _id: "task-1",
        timeSessions: [
          {
            _id: "s1",
            startedAt: "2026-02-14T09:00:00Z",
            endedAt: null,
            userId: "other-user",
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      useTimeTracking(tasksWithOtherActive, setTasks, currentUserId),
    );
    expect(result.current.activeTaskId).toBeNull();
  });

  it("startTracking calls API and updates tasks", async () => {
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
