import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useProjects } from "./use-projects";

const mockProjects = [
  {
    _id: "proj-1",
    name: "Website Redesign",
    categoryId: "cat-1",
    userId: "u1",
    columns: [
      { id: "todo", name: "To Do", order: 0 },
      { id: "done", name: "Done", order: 1 },
    ],
    archived: false,
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useProjects", () => {
  it("fetches projects on mount", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockProjects,
    } as Response);

    const { result } = renderHook(() => useProjects());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projects).toEqual(mockProjects);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    } as Response);

    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Unauthorized");
  });

  it("creates a project and adds to list", async () => {
    const newProj = {
      _id: "proj-2",
      name: "Mobile App",
      categoryId: "cat-1",
      userId: "u1",
      columns: [],
      archived: false,
      createdAt: "",
      updatedAt: "",
    };
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => newProj,
      } as Response);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createProject({
        name: "Mobile App",
        categoryId: "cat-1",
      });
    });

    expect(result.current.projects).toHaveLength(2);
  });

  it("updates a project in the list", async () => {
    const updated = { ...mockProjects[0], name: "Redesign V2" };
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => updated,
      } as Response);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProject("proj-1", { name: "Redesign V2" });
    });

    expect(result.current.projects[0].name).toBe("Redesign V2");
  });

  it("deletes a project from the list", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteProject("proj-1");
    });

    expect(result.current.projects).toHaveLength(0);
  });

  it("throws on create failure", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Name is required" }),
      } as Response);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() =>
        result.current.createProject({ name: "", categoryId: "cat-1" }),
      ),
    ).rejects.toThrow("Name is required");
  });

  describe("sync subscription", () => {
    function emitSync(detail: Record<string, unknown>) {
      window.dispatchEvent(
        new CustomEvent("pillar:sync", { detail }),
      );
    }

    it("adds a project on created event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      } as Response);

      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const newProj = {
        _id: "proj-new",
        name: "New Project",
        categoryId: "cat-1",
        userId: "u1",
        columns: [],
        archived: false,
        createdAt: "",
        updatedAt: "",
      };

      act(() => {
        emitSync({
          entity: "project",
          action: "created",
          entityId: "proj-new",
          data: newProj,
        });
      });

      expect(result.current.projects).toHaveLength(2);
    });

    it("updates a project on updated event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      } as Response);

      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        emitSync({
          entity: "project",
          action: "updated",
          entityId: "proj-1",
          data: { ...mockProjects[0], name: "Synced Name" },
        });
      });

      expect(result.current.projects[0].name).toBe("Synced Name");
    });

    it("removes a project on deleted event", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      } as Response);

      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        emitSync({
          entity: "project",
          action: "deleted",
          entityId: "proj-1",
        });
      });

      expect(result.current.projects).toHaveLength(0);
    });

    it("does not add duplicate projects", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      } as Response);

      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        emitSync({
          entity: "project",
          action: "created",
          entityId: "proj-1",
          data: mockProjects[0],
        });
      });

      expect(result.current.projects).toHaveLength(1);
    });

    it("refetches on pillar:reconnected", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);

      renderHook(() => useProjects());
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

      await act(async () => {
        window.dispatchEvent(new CustomEvent("pillar:reconnected"));
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
