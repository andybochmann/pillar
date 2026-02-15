"use client";

import { useState, useEffect, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Category } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: string | null;
  createCategory: (data: {
    name: string;
    color?: string;
    icon?: string;
  }) => Promise<Category>;
  updateCategory: (
    id: string,
    data: Partial<Pick<Category, "name" | "color" | "icon" | "order">>,
  ) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/categories");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch categories");
      }
      setCategories(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(
    async (data: { name: string; color?: string; icon?: string }) => {
      const res = await offlineFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create category");
      }
      const created: Category = await res.json();
      setCategories((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const updateCategory = useCallback(
    async (
      id: string,
      data: Partial<Pick<Category, "name" | "color" | "icon" | "order">>,
    ) => {
      const res = await offlineFetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update category");
      }
      const updated: Category = await res.json();
      setCategories((prev) => prev.map((c) => (c._id === id ? updated : c)));
      return updated;
    },
    [],
  );

  const deleteCategory = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/categories/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete category");
    }
    setCategories((prev) => prev.filter((c) => c._id !== id));
  }, []);

  // Real-time sync subscription
  useSyncSubscription("category", useCallback((event: SyncEvent) => {
    const data = event.data as Category | undefined;

    switch (event.action) {
      case "created":
        if (!data) return;
        setCategories((prev) => {
          if (prev.some((c) => c._id === data._id)) return prev;
          return [...prev, data];
        });
        break;
      case "updated":
        if (!data) return;
        setCategories((prev) => prev.map((c) => (c._id === event.entityId ? data : c)));
        break;
      case "deleted":
        setCategories((prev) => prev.filter((c) => c._id !== event.entityId));
        break;
    }
  }, []));

  useRefetchOnReconnect(fetchCategories);

  return {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: fetchCategories,
  };
}
