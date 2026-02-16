import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTaskCounts } from "./use-task-counts";

const mockCounts = {
  byCategory: { "cat-1": 5, "cat-2": 3 },
  byProjectAndColumn: {
    "proj-1": { todo: 2, done: 3 },
    "proj-2": { "in-progress": 1, review: 2 },
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useTaskCounts", () => {
  it("fetches counts on mount", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockCounts,
    } as Response);

    const { result } = renderHook(() => useTaskCounts());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toEqual(mockCounts);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    const { result } = renderHook(() => useTaskCounts());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Unauthorized");
    expect(result.current.counts).toBeNull();
  });

  it("refreshes counts when refresh is called", async () => {
    const refreshed = {
      byCategory: { "cat-1": 10 },
      byProjectAndColumn: { "proj-1": { todo: 10 } },
    };

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCounts,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => refreshed,
      } as Response);

    const { result } = renderHook(() => useTaskCounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.counts).toEqual(refreshed);
  });

  describe("offline resilience", () => {
    it("skips fetch when offline and data exists", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockCounts,
      } as Response);

      const { result } = renderHook(() => useTaskCounts());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

      await act(async () => {
        await result.current.refresh();
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.current.counts).toEqual(mockCounts);
    });

    it("keeps existing data on fetch error", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCounts,
        } as Response)
        .mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useTaskCounts());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.counts).toEqual(mockCounts);
      expect(result.current.error).toBeNull();
    });

    it("sets error on first fetch failure when no data", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useTaskCounts());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Network error");
    });
  });

  it("calls correct API endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockCounts,
    } as Response);

    renderHook(() => useTaskCounts());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    expect(fetchSpy).toHaveBeenCalledWith("/api/stats/task-counts");
  });
});
