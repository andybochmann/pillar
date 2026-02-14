"use client";

import { useState, useEffect, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import type { Label } from "@/types";

interface UseLabelsReturn {
  labels: Label[];
  loading: boolean;
  error: string | null;
  createLabel: (data: { name: string; color: string }) => Promise<Label>;
  updateLabel: (
    id: string,
    data: Partial<Pick<Label, "name" | "color">>,
  ) => Promise<Label>;
  deleteLabel: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLabels(): UseLabelsReturn {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLabels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/labels");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch labels");
      }
      setLabels(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const createLabel = useCallback(
    async (data: { name: string; color: string }) => {
      const res = await offlineFetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create label");
      }
      const created: Label = await res.json();
      setLabels((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return created;
    },
    [],
  );

  const updateLabel = useCallback(
    async (id: string, data: Partial<Pick<Label, "name" | "color">>) => {
      const res = await offlineFetch(`/api/labels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update label");
      }
      const updated: Label = await res.json();
      setLabels((prev) =>
        prev
          .map((l) => (l._id === id ? updated : l))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    },
    [],
  );

  const deleteLabel = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/labels/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete label");
    }
    setLabels((prev) => prev.filter((l) => l._id !== id));
  }, []);

  return {
    labels,
    loading,
    error,
    createLabel,
    updateLabel,
    deleteLabel,
    refresh: fetchLabels,
  };
}
