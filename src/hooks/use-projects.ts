"use client";

import { useState, useEffect, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import type { Project } from "@/types";

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (data: {
    name: string;
    description?: string;
    categoryId: string;
  }) => Promise<Project>;
  updateProject: (
    id: string,
    data: Partial<
      Pick<
        Project,
        "name" | "description" | "categoryId" | "columns" | "archived"
      >
    >,
  ) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refresh: (includeArchived?: boolean) => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (includeArchived = false) => {
    try {
      setLoading(true);
      setError(null);
      const url = includeArchived
        ? "/api/projects?includeArchived=true"
        : "/api/projects";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch projects");
      }
      setProjects(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
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
          "name" | "description" | "categoryId" | "columns" | "archived"
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
