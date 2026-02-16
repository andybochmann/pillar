"use client";

import { useState, useEffect, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Project } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (data: {
    name: string;
    description?: string;
    categoryId: string;
    viewType?: "board" | "list";
  }) => Promise<Project>;
  updateProject: (
    id: string,
    data: Partial<
      Pick<
        Project,
        "name" | "description" | "categoryId" | "columns" | "viewType" | "archived"
      >
    >,
  ) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refresh: (includeArchived?: boolean) => Promise<void>;
}

/**
 * Manages project state with CRUD operations, real-time synchronization, and offline support.
 *
 * This hook provides a complete interface for managing projects across the application, including:
 * - Automatic fetching of projects on mount
 * - Local state management with optimistic updates
 * - Real-time synchronization via Server-Sent Events (SSE)
 * - Offline mutation queuing via offlineFetch
 * - Automatic refetch on network reconnection
 * - Support for filtering archived projects
 *
 * @returns {UseProjectsReturn} Object containing:
 *   - `projects`: Array of projects in current state
 *   - `loading`: Boolean indicating if a fetch operation is in progress
 *   - `error`: Error message string or null
 *   - `createProject`: Function to create a new project with optimistic update
 *   - `updateProject`: Function to update a project with optimistic update
 *   - `deleteProject`: Function to delete a project with optimistic update
 *   - `refresh`: Function to manually refetch projects (optionally including archived)
 *
 * @example
 * ```tsx
 * function ProjectList() {
 *   const {
 *     projects,
 *     loading,
 *     error,
 *     createProject,
 *     updateProject,
 *     deleteProject,
 *     refresh
 *   } = useProjects();
 *
 *   const handleCreateProject = async () => {
 *     try {
 *       await createProject({
 *         name: "New Project",
 *         categoryId: "cat-123",
 *         viewType: "board"
 *       });
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   const handleArchiveToggle = async (projectId: string, archived: boolean) => {
 *     await updateProject(projectId, { archived });
 *     // Refresh to show/hide archived projects
 *     refresh(true);
 *   };
 *
 *   if (loading) return <Spinner />;
 *   return <div>{projects.map(p => <ProjectCard key={p._id} project={p} />)}</div>;
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Automatically fetches all projects on component mount
 * - Subscribes to real-time project events (created, updated, deleted) via SSE
 * - Automatically refetches projects on network reconnection
 * - All mutations use `offlineFetch` to queue operations when offline
 * - Optimistic updates are applied immediately; SSE events reconcile state across tabs/users
 */
export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (includeArchived = false) => {
    try {
      setLoading(true);
      setError(null);
      const url = includeArchived ? "/api/projects?includeArchived=true" : "/api/projects";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch projects");
      }
      setProjects(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(
    async (data: {
      name: string;
      description?: string;
      categoryId: string;
      viewType?: "board" | "list";
    }) => {
      const res = await offlineFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create project");
      }
      const created: Project = await res.json();
      setProjects((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const updateProject = useCallback(
    async (
      id: string,
      data: Partial<
        Pick<
          Project,
          "name" | "description" | "categoryId" | "columns" | "viewType" | "archived"
        >
      >,
    ) => {
      const res = await offlineFetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update project");
      }
      const updated: Project = await res.json();
      setProjects((prev) => prev.map((p) => (p._id === id ? updated : p)));
      return updated;
    },
    [],
  );

  const deleteProject = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete project");
    }
    setProjects((prev) => prev.filter((p) => p._id !== id));
  }, []);

  // Real-time sync subscription
  useSyncSubscription("project", useCallback((event: SyncEvent) => {
    const data = event.data as Project | undefined;

    switch (event.action) {
      case "created":
        if (!data) return;
        setProjects((prev) => {
          if (prev.some((p) => p._id === data._id)) return prev;
          return [...prev, data];
        });
        break;
      case "updated":
        if (!data) return;
        setProjects((prev) => prev.map((p) => (p._id === event.entityId ? data : p)));
        break;
      case "deleted":
        setProjects((prev) => prev.filter((p) => p._id !== event.entityId));
        break;
    }
  }, []));

  useRefetchOnReconnect(fetchProjects);

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh: fetchProjects,
  };
}
