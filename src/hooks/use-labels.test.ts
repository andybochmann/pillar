import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLabels } from "./use-labels";

const mockLabels = [
  {
    _id: "lbl-1",
    name: "Bug",
    color: "#ef4444",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "lbl-2",
    name: "Feature",
    color: "#3b82f6",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useLabels", () => {
  it("fetches labels on mount", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockLabels,
    } as Response);

    const { result } = renderHook(() => useLabels());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.labels).toEqual(mockLabels);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    const { result } = renderHook(() => useLabels());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Unauthorized");
    expect(result.current.labels).toEqual([]);
  });

  it("creates a label and adds to sorted list", async () => {
    const newLabel = {
      _id: "lbl-3",
      name: "Chore",
      color: "#a855f7",
      userId: "u1",
      createdAt: "",
      updatedAt: "",
    };
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLabels,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => newLabel,
      } as Response);

    const { result } = renderHook(() => useLabels());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.createLabel({
        name: "Chore",
        color: "#a855f7",
      });
    });

    expect(created).toEqual(newLabel);
    expect(result.current.labels).toHaveLength(3);
    // Sorted: Bug, Chore, Feature
    expect(result.current.labels[1].name).toBe("Chore");
  });

  it("throws on create failure", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Label already exists" }),
      } as Response);

    const { result } = renderHook(() => useLabels());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() => result.current.createLabel({ name: "Bug", color: "#ef4444" })),
    ).rejects.toThrow("Label already exists");
  });

  it("updates a label in the list", async () => {
    const updated = { ...mockLabels[0], name: "Defect" };
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLabels,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => updated,
      } as Response);

    const { result } = renderHook(() => useLabels());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateLabel("lbl-1", { name: "Defect" });
    });

    expect(result.current.labels.find((l) => l._id === "lbl-1")?.name).toBe(
      "Defect",
    );
  });

  it("deletes a label from the list", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLabels,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

    const { result } = renderHook(() => useLabels());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteLabel("lbl-1");
    });

    expect(result.current.labels).toHaveLength(1);
    expect(result.current.labels[0]._id).toBe("lbl-2");
  });

  it("refreshes labels", async () => {
    const refreshed = [mockLabels[0]];
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLabels,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => refreshed,
      } as Response);

    const { result } = renderHook(() => useLabels());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.labels).toHaveLength(1);
  });
});
