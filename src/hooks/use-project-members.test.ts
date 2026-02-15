import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProjectMembers } from "./use-project-members";
import type { ProjectMember } from "@/types";

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

const mockMember: ProjectMember = {
  _id: "mem1",
  projectId: "proj1",
  userId: "user1",
  role: "editor",
  invitedBy: "owner1",
  userName: "Test User",
  userEmail: "test@test.com",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("useProjectMembers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it("fetches members", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockMember]),
    } as Response);

    const { result } = renderHook(() => useProjectMembers("proj1"));

    await act(async () => {
      await result.current.fetchMembers("proj1");
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0].userName).toBe("Test User");
  });

  it("handles fetch error", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    } as Response);

    const { result } = renderHook(() => useProjectMembers("proj1"));

    await act(async () => {
      await result.current.fetchMembers("proj1");
    });

    expect(result.current.error).toBe("Not found");
    expect(result.current.members).toHaveLength(0);
  });

  it("adds a member", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMember),
    } as Response);

    const { result } = renderHook(() => useProjectMembers("proj1"));

    let created: ProjectMember | undefined;
    await act(async () => {
      created = await result.current.addMember("proj1", "test@test.com");
    });

    expect(created!.userEmail).toBe("test@test.com");
    expect(result.current.members).toHaveLength(1);
  });

  it("removes a member", async () => {
    // First set up initial state
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockMember]),
    } as Response);

    const { result } = renderHook(() => useProjectMembers("proj1"));
    await act(async () => {
      await result.current.fetchMembers("proj1");
    });
    expect(result.current.members).toHaveLength(1);

    // Now remove
    const { offlineFetch } = await import("@/lib/offline-fetch");
    vi.mocked(offlineFetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await act(async () => {
      await result.current.removeMember("proj1", "mem1");
    });

    expect(result.current.members).toHaveLength(0);
  });
});
