import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePrecache } from "./use-precache";

// --- Mocks ---

const mockPrefetch = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: mockPrefetch }),
}));

const mockIsOnline = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: () => ({ isOnline: mockIsOnline.value }),
}));

describe("usePrecache", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockIsOnline.value = true;
    mockPrefetch.mockClear();
    sessionStorage.clear();

    // Mock requestIdleCallback
    vi.stubGlobal(
      "requestIdleCallback",
      (cb: IdleRequestCallback) => setTimeout(() => cb({} as IdleDeadline), 0) as unknown as number,
    );
    vi.stubGlobal("cancelIdleCallback", (id: number) => clearTimeout(id));

    // Default: fetch returns empty arrays
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not run when offline", async () => {
    mockIsOnline.value = false;

    renderHook(() => usePrecache());

    // Advance past the 5s delay + idle callback
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not run when sessionStorage key already set", async () => {
    sessionStorage.setItem("pillar:precache-done", "1");

    renderHook(() => usePrecache());

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches projects, labels, and task-counts after delay", async () => {
    renderHook(() => usePrecache());

    // Should not have fetched yet
    expect(fetch).not.toHaveBeenCalled();

    // Advance past 5s delay + idle callback
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    expect(fetch).toHaveBeenCalledWith("/api/projects");
    expect(fetch).toHaveBeenCalledWith("/api/labels");
    expect(fetch).toHaveBeenCalledWith("/api/stats/task-counts");
  });

  it("fetches tasks for each project sequentially", async () => {
    const projects = [
      { _id: "p1", name: "Project 1" },
      { _id: "p2", name: "Project 2" },
      { _id: "p3", name: "Project 3" },
    ];

    vi.mocked(fetch).mockImplementation((url) => {
      if (url === "/api/projects") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(projects),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);
    });

    renderHook(() => usePrecache());

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    for (let i = 0; i < projects.length; i++) {
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
    }

    expect(fetch).toHaveBeenCalledWith("/api/tasks?projectId=p1");
    expect(fetch).toHaveBeenCalledWith("/api/tasks?projectId=p2");
    expect(fetch).toHaveBeenCalledWith("/api/tasks?projectId=p3");
  });

  it("calls router.prefetch() for each project route", async () => {
    const projects = [
      { _id: "p1", name: "Project 1" },
      { _id: "p2", name: "Project 2" },
    ];

    vi.mocked(fetch).mockImplementation((url) => {
      if (url === "/api/projects") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(projects),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);
    });

    renderHook(() => usePrecache());

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    for (let i = 0; i < projects.length; i++) {
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
    }

    expect(mockPrefetch).toHaveBeenCalledWith("/projects/p1");
    expect(mockPrefetch).toHaveBeenCalledWith("/projects/p2");
  });

  it("sets sessionStorage key after completion", async () => {
    renderHook(() => usePrecache());

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    // Wait for the async precache to complete
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(sessionStorage.getItem("pillar:precache-done")).toBe("1");
  });

  it("stops fetching if device goes offline mid-run", async () => {
    const projects = [
      { _id: "p1", name: "Project 1" },
      { _id: "p2", name: "Project 2" },
      { _id: "p3", name: "Project 3" },
    ];

    let online = true;
    Object.defineProperty(navigator, "onLine", {
      get: () => online,
      configurable: true,
    });

    vi.mocked(fetch).mockImplementation((url) => {
      if (url === "/api/projects") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(projects),
        } as Response);
      }
      if (typeof url === "string" && url.startsWith("/api/tasks")) {
        online = false;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);
    });

    renderHook(() => usePrecache());

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    for (let i = 0; i < projects.length; i++) {
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
    }

    const taskFetches = vi.mocked(fetch).mock.calls.filter(
      ([url]) => typeof url === "string" && url.startsWith("/api/tasks"),
    );
    expect(taskFetches.length).toBe(1);

    Object.defineProperty(navigator, "onLine", {
      get: () => true,
      configurable: true,
    });
  });

  it("prefetches newly created projects via sync event", async () => {
    renderHook(() => usePrecache());

    // Complete initial precache first
    await act(async () => {
      vi.advanceTimersByTime(5500);
    });

    // Reset fetch mock to track new calls
    vi.mocked(fetch).mockClear();

    // Dispatch a sync event for a new project
    const syncEvent = new CustomEvent("pillar:sync", {
      detail: {
        entity: "project",
        action: "created",
        entityId: "new-proj-1",
        userId: "u1",
        sessionId: "s1",
        timestamp: Date.now(),
      },
    });
    act(() => {
      window.dispatchEvent(syncEvent);
    });

    // Advance past the 1s delay for new project prefetch
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(fetch).toHaveBeenCalledWith("/api/tasks?projectId=new-proj-1");
    expect(mockPrefetch).toHaveBeenCalledWith("/projects/new-proj-1");
  });

  it("does not run twice in same session (ref guard)", async () => {
    const { rerender } = renderHook(() => usePrecache());

    await act(async () => {
      vi.advanceTimersByTime(5500);
    });

    const callCountAfterFirst = vi.mocked(fetch).mock.calls.length;

    // Rerender the hook (simulates re-mount)
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    // No additional fetch calls beyond the first run
    expect(vi.mocked(fetch).mock.calls.length).toBe(callCountAfterFirst);
  });
});
