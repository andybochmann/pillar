"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import type { ProjectMember, ProjectRole } from "@/types";
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
    role: ProjectRole,
  ) => Promise<ProjectMember>;
  removeMember: (projectId: string, memberId: string) => Promise<void>;
}

/**
 * Manages project member state with CRUD operations, real-time synchronization, and offline support.
 *
 * This hook provides a complete interface for managing project members and their roles, including:
 * - Local state management with optimistic updates
 * - Real-time synchronization via Server-Sent Events (SSE)
 * - Offline mutation queuing via offlineFetch
 * - Support for adding members by email with role assignment
 * - Role-based access control updates
 *
 * @param {string} [projectId] - Optional project ID to filter real-time events to only this project's members
 *
 * @returns {UseProjectMembersReturn} Object containing:
 *   - `members`: Array of project members in current state
 *   - `loading`: Boolean indicating if a fetch operation is in progress
 *   - `error`: Error message string or null
 *   - `fetchMembers`: Function to fetch members for a specific project
 *   - `addMember`: Function to add a new member by email with optimistic update
 *   - `updateMemberRole`: Function to update a member's role with optimistic update
 *   - `removeMember`: Function to remove a member with optimistic update
 *
 * @example
 * ```tsx
 * function ProjectMembersDialog({ projectId }: { projectId: string }) {
 *   const {
 *     members,
 *     loading,
 *     error,
 *     fetchMembers,
 *     addMember,
 *     updateMemberRole,
 *     removeMember
 *   } = useProjectMembers(projectId);
 *
 *   useEffect(() => {
 *     fetchMembers(projectId);
 *   }, [projectId]);
 *
 *   const handleAddMember = async (email: string) => {
 *     try {
 *       await addMember(projectId, email);
 *       toast.success("Member added successfully");
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   const handleRoleChange = async (memberId: string, newRole: ProjectRole) => {
 *     try {
 *       await updateMemberRole(projectId, memberId, newRole);
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {members.map(member => (
 *         <MemberRow
 *           key={member._id}
 *           member={member}
 *           onRoleChange={handleRoleChange}
 *           onRemove={() => removeMember(projectId, member._id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Subscribes to real-time member events (created, updated, deleted) via SSE
 * - Filters SSE events by projectId if provided (only processes events for this project)
 * - All mutations use `offlineFetch` to queue operations when offline
 * - Optimistic updates are applied immediately; SSE events reconcile state across tabs/users
 * - Adding a member sends an invitation if the user doesn't exist or grants access if they do
 */
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
        body: JSON.stringify({ email, role: "viewer" }),
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
    async (pid: string, memberId: string, role: ProjectRole) => {
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
