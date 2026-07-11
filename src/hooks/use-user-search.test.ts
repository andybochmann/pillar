import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUserSearch } from "./use-user-search";

describe("useUserSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn();
  });

  it("returns empty results initially", () => {
    const { result } = renderHook(() => useUserSearch());
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("does not search for queries shorter than 2 chars", () => {
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search("a");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  it("searches after debounce", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          { _id: "1", name: "Alice", email: "alice@test.com" },
        ]),
    } as Response);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search("alice");
    });

    expect(result.current.loading).toBe(true);

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].email).toBe("alice@test.com");
    });
  });

  it("clears results", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([{ _id: "1", name: "Alice", email: "alice@test.com" }]),
    } as Response);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search("alice");
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.results).toEqual([]);
  });

  it("resets loading when cleared mid-debounce (M12)", () => {
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search("alice");
    });
    // Debounce is pending, so the spinner is showing.
    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.clear();
    });

    // clear() must not leave the spinner stuck.
    expect(result.current.loading).toBe(false);
  });

  it("ignores a stale response after a newer clear (M12)", async () => {
    let resolveFirst!: (v: Response) => void;
    vi.mocked(global.fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search("alice");
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Clear invalidates the in-flight request.
    act(() => {
      result.current.clear();
    });

    // The stale response resolves after the clear — it must be ignored.
    await act(async () => {
      resolveFirst({
        ok: true,
        json: () =>
          Promise.resolve([{ _id: "1", name: "Alice", email: "alice@test.com" }]),
      } as unknown as Response);
    });

    expect(result.current.results).toEqual([]);
  });
});
