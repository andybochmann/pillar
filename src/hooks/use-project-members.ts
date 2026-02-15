"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import type { ProjectMember } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

interface UseProjectMembersReturn {
  members: ProjectMember[];
  loading: boolean;
  error: string | null;
  fetchMembers: (projectId: string) => Promise<void>;
  addMember: (projectId: string, email: string) => Promise<ProjectMember>;
  updateMemberRole: (
    projectId: string,
    memberId: string,
    role: "owner" | "editor",
  ) => Promise<ProjectMember>;
  removeMember: (projectId: string, memberId: string) => Promise<void>;
}

export function useProjectMembers(projectId?: string): UseProjectMembersReturn {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async (pid: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${pid}/members`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch members");
      }
      setMembers(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addMember = useCallback(
    async (pid: string, email: string) => {
      const res = await offlineFetch(`/api/projects/${pid}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "editor" }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to add member");
      }
      const created: ProjectMember = await res.json();
      setMembers((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const updateMemberRole = useCallback(
    async (pid: string, memberId: string, role: "owner" | "editor") => {
      const res = await offlineFetch(
        `/api/projects/${pid}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update role");
      }
      const updated: ProjectMember = await res.json();
      setMembers((prev) =>
        prev.map((m) => (m._id === memberId ? { ...m, ...updated } : m)),
      );
      return updated;
    },
    [],
  );

  const removeMember = useCallback(
    async (pid: string, memberId: string) => {
      const res = await offlineFetch(
        `/api/projects/${pid}/members/${memberId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to remove member");
      }
      setMembers((prev) => prev.filter((m) => m._id !== memberId));
    },
    [],
  );

  // Real-time sync subscription
  useSyncSubscription(
    "member",
    useCallback(
      (event: SyncEvent) => {
        if (projectId && event.projectId !== projectId) return;

        switch (event.action) {
          case "created": {
            const data = event.data as ProjectMember | undefined;
            if (data) {
              setMembers((prev) =>
                prev.some((m) => m._id === data._id) ? prev : [...prev, data]
              );
            }
            break;
          }
          case "updated": {
            const data = event.data as ProjectMember | undefined;
            if (data) {
              setMembers((prev) =>
                prev.map((m) => (m._id === event.entityId ? data : m))
              );
            }
            break;
          }
          case "deleted":
            setMembers((prev) => prev.filter((m) => m._id !== event.entityId));
            break;
        }
      },
      [projectId],
    ),
  );

  return {
    members,
    loading,
    error,
    fetchMembers,
    addMember,
    updateMemberRole,
    removeMember,
  };
}
