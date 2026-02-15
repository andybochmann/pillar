import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGenerateTasks } from "./use-generate-tasks";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe("useGenerateTasks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("starts with empty drafts and not generating", () => {
    const { result } = renderHook(() => useGenerateTasks());
    expect(result.current.drafts).toEqual([]);
    expect(result.current.generating).toBe(false);
    expect(result.current.adding).toBe(false);
  });

  it("sets generating state during generation", async () => {
    const states: boolean[] = [];
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ tasks: [] }),
            });
          }, 10);
        }),
    );

    const { result } = renderHook(() => useGenerateTasks());

    let promise: Promise<void>;
    act(() => {
      promise = result.current.generateTasks("proj-1");
    });
    states.push(result.current.generating);

    await act(async () => {
      await promise!;
    });
    states.push(result.current.generating);

    expect(states[0]).toBe(true);
    expect(states[1]).toBe(false);
  });

  it("populates drafts with generated tasks", async () => {
    global.fetch = mockFetchResponse({
      tasks: [
        {
          title: "Task 1",
          description: "Desc 1",
          priority: "high",
          columnId: "todo",
          subtasks: ["Sub 1"],
        },
        {
          title: "Task 2",
          priority: "medium",
          columnId: "in-progress",
          subtasks: [],
        },
      ],
    });

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    expect(result.current.drafts).toHaveLength(2);
    expect(result.current.drafts[0].title).toBe("Task 1");
    expect(result.current.drafts[0].selected).toBe(true);
    expect(result.current.drafts[0].subtasks).toEqual(["Sub 1"]);
    expect(result.current.drafts[1].columnId).toBe("in-progress");
  });

  it("shows error toast on generation failure", async () => {
    global.fetch = mockFetchResponse(
      { error: "AI failed" },
      false,
      500,
    );

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    expect(toast.error).toHaveBeenCalledWith("AI failed");
    expect(result.current.drafts).toEqual([]);
  });

  it("toggles draft selection", async () => {
    global.fetch = mockFetchResponse({
      tasks: [
        { title: "T1", priority: "medium", columnId: "todo", subtasks: [] },
        { title: "T2", priority: "low", columnId: "todo", subtasks: [] },
      ],
    });

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    const draftId = result.current.drafts[0].id;

    act(() => {
      result.current.toggleDraft(draftId);
    });

    expect(result.current.drafts[0].selected).toBe(false);
    expect(result.current.drafts[1].selected).toBe(true);
  });

  it("toggles all drafts", async () => {
    global.fetch = mockFetchResponse({
      tasks: [
        { title: "T1", priority: "medium", columnId: "todo", subtasks: [] },
        { title: "T2", priority: "low", columnId: "todo", subtasks: [] },
      ],
    });

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    act(() => {
      result.current.toggleAll(false);
    });

    expect(result.current.drafts.every((d) => !d.selected)).toBe(true);

    act(() => {
      result.current.toggleAll(true);
    });

    expect(result.current.drafts.every((d) => d.selected)).toBe(true);
  });

  it("updates a draft", async () => {
    global.fetch = mockFetchResponse({
      tasks: [
        { title: "T1", priority: "medium", columnId: "todo", subtasks: [] },
      ],
    });

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    const draftId = result.current.drafts[0].id;

    act(() => {
      result.current.updateDraft(draftId, {
        title: "Updated Title",
        priority: "high",
      });
    });

    expect(result.current.drafts[0].title).toBe("Updated Title");
    expect(result.current.drafts[0].priority).toBe("high");
  });

  it("adds selected tasks via fetch", async () => {
    // First call: generate tasks. Second call: bulk-create.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              { title: "T1", priority: "medium", columnId: "todo", subtasks: [] },
              { title: "T2", priority: "low", columnId: "done", subtasks: [] },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              { _id: "1", title: "T1" },
              { _id: "2", title: "T2" },
            ],
          }),
      });
    global.fetch = fetchMock;

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    let created: unknown[];
    await act(async () => {
      created = await result.current.addSelectedTasks("proj-1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/bulk-create",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(created!).toHaveLength(2);
    expect(toast.success).toHaveBeenCalledWith("Added 2 tasks");
    expect(result.current.drafts).toEqual([]);
  });

  it("shows error toast when adding fails", async () => {
    // First call: generate tasks (ok). Second call: bulk-create (fail).
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              { title: "T1", priority: "medium", columnId: "todo", subtasks: [] },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      });
    global.fetch = fetchMock;

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    await act(async () => {
      await result.current.addSelectedTasks("proj-1");
    });

    expect(toast.error).toHaveBeenCalledWith("Server error");
  });

  it("resets drafts", async () => {
    global.fetch = mockFetchResponse({
      tasks: [
        { title: "T1", priority: "medium", columnId: "todo", subtasks: [] },
      ],
    });

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1");
    });

    expect(result.current.drafts).toHaveLength(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.drafts).toEqual([]);
  });

  it("passes maxCount to API", async () => {
    global.fetch = mockFetchResponse({ tasks: [] });

    const { result } = renderHook(() => useGenerateTasks());

    await act(async () => {
      await result.current.generateTasks("proj-1", 5);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/generate-tasks",
      expect.objectContaining({
        body: JSON.stringify({ projectId: "proj-1", maxCount: 5 }),
      }),
    );
  });
});
