import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFilterPresets } from "./use-filter-presets";

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

const mockPresets = [
  {
    _id: "preset-1",
    name: "Urgent Overview",
    context: "overview" as const,
    filters: { priority: "urgent" },
    userId: "user-1",
    order: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    _id: "preset-2",
    name: "High Priority Kanban",
    context: "kanban" as const,
    filters: { priorities: ["high"] },
    userId: "user-1",
    order: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

describe("useFilterPresets", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches presets for a given context", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [mockPresets[0]],
    } as Response);

    const { result } = renderHook(() => useFilterPresets("overview"));

    await act(async () => {
      await result.current.fetchPresets();
    });

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe("Urgent Overview");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/filter-presets?context=overview",
    );
  });

  it("creates a preset and adds it to state", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    const newPreset = {
      _id: "preset-3",
      name: "New Preset",
      context: "overview",
      filters: { priority: "high" },
      userId: "user-1",
      order: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => newPreset,
    } as Response);

    const { result } = renderHook(() => useFilterPresets("overview"));

    let created;
    await act(async () => {
      created = await result.current.createPreset("New Preset", {
        priority: "high",
      });
    });

    expect(created).toEqual(newPreset);
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe("New Preset");
  });

  it("updates a preset in state", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [mockPresets[0]],
    } as Response);

    const { result } = renderHook(() => useFilterPresets("overview"));

    await act(async () => {
      await result.current.fetchPresets();
    });

    const updatedPreset = { ...mockPresets[0], name: "Updated Name" };
    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => updatedPreset,
    } as Response);

    await act(async () => {
      await result.current.updatePreset("preset-1", { name: "Updated Name" });
    });

    expect(result.current.presets[0].name).toBe("Updated Name");
  });

  it("deletes a preset from state", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [mockPresets[0]],
    } as Response);

    const { result } = renderHook(() => useFilterPresets("overview"));

    await act(async () => {
      await result.current.fetchPresets();
    });

    expect(result.current.presets).toHaveLength(1);

    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await act(async () => {
      await result.current.deletePreset("preset-1");
    });

    expect(result.current.presets).toHaveLength(0);
  });

  it("sets loading state during fetch", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const { result } = renderHook(() => useFilterPresets("overview"));

    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.fetchPresets();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.presets).toEqual([]);
  });

  it("sets error state on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    } as Response);

    const { result } = renderHook(() => useFilterPresets("overview"));

    await act(async () => {
      await result.current.fetchPresets();
    });

    expect(result.current.error).toBe("Server error");
  });

  it("throws on create failure", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Validation error" }),
    } as Response);

    const { result } = renderHook(() => useFilterPresets("overview"));

    await expect(
      act(() => result.current.createPreset("", {})),
    ).rejects.toThrow("Validation error");
  });

  describe("sync subscription", () => {
    function emitSync(detail: Record<string, unknown>) {
      window.dispatchEvent(new CustomEvent("pillar:sync", { detail }));
    }

    it("adds a preset on created event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      const { result } = renderHook(() => useFilterPresets("overview"));

      await act(async () => {
        await result.current.fetchPresets();
      });

      act(() => {
        emitSync({
          entity: "filter-preset",
          action: "created",
          entityId: "preset-new",
          data: {
            _id: "preset-new",
            name: "New via sync",
            context: "overview",
            filters: {},
            userId: "u1",
            order: 0,
            createdAt: "",
            updatedAt: "",
          },
        });
      });

      expect(result.current.presets).toHaveLength(1);
      expect(result.current.presets[0].name).toBe("New via sync");
    });

    it("ignores created events for different context", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      const { result } = renderHook(() => useFilterPresets("overview"));

      await act(async () => {
        await result.current.fetchPresets();
      });

      act(() => {
        emitSync({
          entity: "filter-preset",
          action: "created",
          entityId: "preset-kanban",
          data: {
            _id: "preset-kanban",
            name: "Kanban preset",
            context: "kanban",
            filters: {},
          },
        });
      });

      expect(result.current.presets).toHaveLength(0);
    });

    it("removes a preset on deleted event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => [mockPresets[0]],
      } as Response);

      const { result } = renderHook(() => useFilterPresets("overview"));

      await act(async () => {
        await result.current.fetchPresets();
      });

      act(() => {
        emitSync({
          entity: "filter-preset",
          action: "deleted",
          entityId: "preset-1",
        });
      });

      expect(result.current.presets).toHaveLength(0);
    });
  });
});
