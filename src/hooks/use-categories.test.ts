import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCategories } from "./use-categories";

const mockCategories = [
  {
    _id: "cat-1",
    name: "Work",
    color: "#6366f1",
    order: 0,
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "cat-2",
    name: "Personal",
    color: "#22c55e",
    order: 1,
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useCategories", () => {
  it("fetches categories on mount", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockCategories,
    } as Response);

    const { result } = renderHook(() => useCategories());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toEqual(mockCategories);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Unauthorized");
    expect(result.current.categories).toEqual([]);
  });

  it("creates a category and adds to list", async () => {
    const newCat = {
      _id: "cat-3",
      name: "Side",
      color: "#ef4444",
      order: 2,
      userId: "u1",
      createdAt: "",
      updatedAt: "",
    };
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => newCat,
      } as Response);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.createCategory({
        name: "Side",
        color: "#ef4444",
      });
    });

    expect(created).toEqual(newCat);
    expect(result.current.categories).toHaveLength(3);
  });

  it("throws on create failure", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Name is required" }),
      } as Response);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() => result.current.createCategory({ name: "" })),
    ).rejects.toThrow("Name is required");
  });

  it("updates a category in the list", async () => {
    const updated = { ...mockCategories[0], name: "Updated Work" };
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => updated,
      } as Response);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateCategory("cat-1", { name: "Updated Work" });
    });

    expect(result.current.categories[0].name).toBe("Updated Work");
  });

  it("deletes a category from the list", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteCategory("cat-1");
    });

    expect(result.current.categories).toHaveLength(1);
    expect(result.current.categories[0]._id).toBe("cat-2");
  });

  it("refreshes categories", async () => {
    const refreshed = [mockCategories[0]];
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => refreshed,
      } as Response);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.categories).toHaveLength(1);
  });

  describe("sync subscription", () => {
    function emitSync(detail: Record<string, unknown>) {
      window.dispatchEvent(new CustomEvent("pillar:sync", { detail }));
    }

    it("adds a category on created event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response);

      const { result } = renderHook(() => useCategories());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        emitSync({
          entity: "category",
          action: "created",
          entityId: "cat-new",
          data: { _id: "cat-new", name: "New", color: "#000000", order: 2, userId: "u1", createdAt: "", updatedAt: "" },
        });
      });

      expect(result.current.categories).toHaveLength(3);
    });

    it("updates a category on updated event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response);

      const { result } = renderHook(() => useCategories());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        emitSync({
          entity: "category",
          action: "updated",
          entityId: "cat-1",
          data: { ...mockCategories[0], name: "Synced" },
        });
      });

      expect(result.current.categories[0].name).toBe("Synced");
    });

    it("removes a category on deleted event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response);

      const { result } = renderHook(() => useCategories());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        emitSync({ entity: "category", action: "deleted", entityId: "cat-1" });
      });

      expect(result.current.categories).toHaveLength(1);
    });
  });
});
