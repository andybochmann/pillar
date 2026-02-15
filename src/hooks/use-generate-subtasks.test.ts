import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGenerateSubtasks } from "./use-generate-subtasks";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

function mockFetchResponse(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

describe("useGenerateSubtasks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("starts with empty drafts and not generating", () => {
    const { result } = renderHook(() => useGenerateSubtasks());
    expect(result.current.drafts).toEqual([]);
    expect(result.current.generating).toBe(false);
  });

  it("sets generating state during generation", async () => {
    const states: boolean[] = [];
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ subtasks: [] }),
            });
          }, 10);
        }),
    );

    const { result } = renderHook(() => useGenerateSubtasks());

    let promise: Promise<void>;
    act(() => {
      promise = result.current.generateSubtasks("Test task");
    });
    states.push(result.current.generating);

    await act(async () => {
      await promise!;
    });
    states.push(result.current.generating);

    expect(states[0]).toBe(true);
    expect(states[1]).toBe(false);
  });

  it("populates drafts with generated subtasks", async () => {
    global.fetch = mockFetchResponse({
      subtasks: ["Write tests", "Implement feature", "Deploy"],
    });

    const { result } = renderHook(() => useGenerateSubtasks());

    await act(async () => {
      await result.current.generateSubtasks("Build login page");
    });

    expect(result.current.drafts).toHaveLength(3);
    expect(result.current.drafts[0].title).toBe("Write tests");
    expect(result.current.drafts[0].selected).toBe(true);
    expect(result.current.drafts[1].title).toBe("Implement feature");
    expect(result.current.drafts[2].title).toBe("Deploy");
  });

  it("shows error toast on generation failure", async () => {
    global.fetch = mockFetchResponse({ error: "AI failed" }, false);

    const { result } = renderHook(() => useGenerateSubtasks());

    await act(async () => {
      await result.current.generateSubtasks("Test task");
    });

    expect(toast.error).toHaveBeenCalledWith("AI failed");
    expect(result.current.drafts).toEqual([]);
  });

  it("toggles draft selection", async () => {
    global.fetch = mockFetchResponse({
      subtasks: ["Step 1", "Step 2"],
    });

    const { result } = renderHook(() => useGenerateSubtasks());

    await act(async () => {
      await result.current.generateSubtasks("Test task");
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
      subtasks: ["Step 1", "Step 2"],
    });

    const { result } = renderHook(() => useGenerateSubtasks());

    await act(async () => {
      await result.current.generateSubtasks("Test task");
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

  it("updates a draft title", async () => {
    global.fetch = mockFetchResponse({
      subtasks: ["Step 1"],
    });

    const { result } = renderHook(() => useGenerateSubtasks());

    await act(async () => {
      await result.current.generateSubtasks("Test task");
    });

    const draftId = result.current.drafts[0].id;

    act(() => {
      result.current.updateDraft(draftId, { title: "Updated Step" });
    });

    expect(result.current.drafts[0].title).toBe("Updated Step");
  });

  it("resets drafts", async () => {
    global.fetch = mockFetchResponse({
      subtasks: ["Step 1"],
    });

    const { result } = renderHook(() => useGenerateSubtasks());

    await act(async () => {
      await result.current.generateSubtasks("Test task");
    });

    expect(result.current.drafts).toHaveLength(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.drafts).toEqual([]);
  });

  it("passes all parameters to API", async () => {
    global.fetch = mockFetchResponse({ subtasks: [] });

    const { result } = renderHook(() => useGenerateSubtasks());

    await act(async () => {
      await result.current.generateSubtasks(
        "Build login",
        "OAuth login",
        "high",
        ["Existing step"],
        3,
        "Use Google provider",
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/generate-subtasks",
      expect.objectContaining({
        body: JSON.stringify({
          title: "Build login",
          description: "OAuth login",
          priority: "high",
          existingSubtasks: ["Existing step"],
          maxCount: 3,
          context: "Use Google provider",
        }),
      }),
    );
  });
});
