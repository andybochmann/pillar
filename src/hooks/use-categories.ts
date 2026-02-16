"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

/**
 * Manages category state with CRUD operations, real-time synchronization, and offline support.
 *
 * This hook provides a complete interface for managing categories (project groupings), including:
 * - Automatic fetching of categories on mount
 * - Local state management with optimistic updates
 * - Real-time synchronization via Server-Sent Events (SSE)
 * - Offline mutation queuing via offlineFetch
 * - Automatic refetch on network reconnection
 *
 * @returns {UseCategoriesReturn} Object containing:
 *   - `categories`: Array of categories in current state
 *   - `loading`: Boolean indicating if a fetch operation is in progress
 *   - `error`: Error message string or null
 *   - `createCategory`: Function to create a new category with optimistic update
 *   - `updateCategory`: Function to update a category with optimistic update
 *   - `deleteCategory`: Function to delete a category with optimistic update
 *   - `refresh`: Function to manually refetch categories
 *
 * @example
 * ```tsx
 * function CategoryManager() {
 *   const {
 *     categories,
 *     loading,
 *     error,
 *     createCategory,
 *     updateCategory,
 *     deleteCategory
 *   } = useCategories();
 *
 *   const handleCreateCategory = async () => {
 *     try {
 *       await createCategory({
 *         name: "Work",
 *         color: "#3b82f6",
 *         icon: "briefcase"
 *       });
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   const handleUpdateOrder = async (categoryId: string, newOrder: number) => {
 *     await updateCategory(categoryId, { order: newOrder });
 *   };
 *
 *   if (loading) return <Spinner />;
 *   return <div>{categories.map(c => <CategoryCard key={c._id} category={c} />)}</div>;
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Automatically fetches all categories on component mount
 * - Subscribes to real-time category events (created, updated, deleted) via SSE
 * - Automatically refetches categories on network reconnection
 * - All mutations use `offlineFetch` to queue operations when offline
 * - Optimistic updates are applied immediately; SSE events reconcile state across tabs/users
 */
export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  const fetchCategories = useCallback(async () => {
    if (!navigator.onLine && hasData.current) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/categories");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch categories");
      }
      setCategories(await res.json());
      hasData.current = true;
    } catch (err) {
      if (!hasData.current) {
        setError((err as Error).message);
      }
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
