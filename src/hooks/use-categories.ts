"use client";

import { useState, useEffect, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import type { Category } from "@/types";

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
