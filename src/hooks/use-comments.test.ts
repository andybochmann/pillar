import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useComments } from "./use-comments";
import type { Comment } from "@/types";

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

const mockComment: Comment = {
  _id: "c1",
  taskId: "task1",
  projectId: "proj1",
  userId: "user1",
  body: "First comment",
  mentions: [],
  authorName: "Test User",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useComments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it("fetches comments for a task", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockComment]),
    } as Response);

    const { result } = renderHook(() => useComments("task1"));

    await act(async () => {
      await result.current.fetchComments();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/tasks/task1/comments");
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].body).toBe("First comment");
  });

  it("surfaces fetch errors", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Task not found" }),
    } as Response);

    const { result } = renderHook(() => useComments("task1"));

    await act(async () => {
      await result.current.fetchComments();
    });

    expect(result.current.error).toBe("Task not found");
    expect(result.current.comments).toHaveLength(0);
  });

  it("adds a comment optimistically via offlineFetch", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockComment),
    } as Response);

    const { result } = renderHook(() => useComments("task1"));

    await act(async () => {
      await result.current.addComment({ body: "First comment", mentions: [] });
    });

    expect(offlineFetch).toHaveBeenCalledWith(
      "/api/tasks/task1/comments",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.comments).toEqual([mockComment]);
  });

  it("throws when adding a comment fails", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Comment cannot be empty" }),
    } as Response);

    const { result } = renderHook(() => useComments("task1"));

    await expect(
      result.current.addComment({ body: "" }),
    ).rejects.toThrow("Comment cannot be empty");
  });

  it("deletes a comment via offlineFetch", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    // Seed a comment
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockComment]),
    } as Response);
    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const { result } = renderHook(() => useComments("task1"));

    await act(async () => {
      await result.current.fetchComments();
    });
    await act(async () => {
      await result.current.deleteComment("c1");
    });

    expect(offlineFetch).toHaveBeenCalledWith(
      "/api/tasks/task1/comments/c1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result.current.comments).toHaveLength(0);
  });

  it("appends a comment on a matching sync event", async () => {
    renderHook(() => useComments("task1"));
    // Nothing to assert on the discarded render; use a fresh instance
    const { result } = renderHook(() => useComments("task1"));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: {
            entity: "comment",
            action: "created",
            entityId: "c2",
            data: { ...mockComment, _id: "c2", body: "From another tab" },
          },
        }),
      );
    });

    await waitFor(() =>
      expect(result.current.comments.some((c) => c._id === "c2")).toBe(true),
    );
  });

  it("ignores created sync events for other tasks", async () => {
    const { result } = renderHook(() => useComments("task1"));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: {
            entity: "comment",
            action: "created",
            entityId: "c9",
            data: { ...mockComment, _id: "c9", taskId: "other-task" },
          },
        }),
      );
    });

    expect(result.current.comments).toHaveLength(0);
  });

  it("removes a comment on a delete sync event", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockComment]),
    } as Response);

    const { result } = renderHook(() => useComments("task1"));

    await act(async () => {
      await result.current.fetchComments();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", {
          detail: {
            entity: "comment",
            action: "deleted",
            entityId: "c1",
          },
        }),
      );
    });

    await waitFor(() => expect(result.current.comments).toHaveLength(0));
  });
});
