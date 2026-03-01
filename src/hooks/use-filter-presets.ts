"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import type { FilterPreset, FilterPresetContext } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

interface UseFilterPresetsReturn {
  presets: FilterPreset[];
  loading: boolean;
  error: string | null;
  fetchPresets: () => Promise<void>;
  createPreset: (
    name: string,
    filters: Record<string, string | string[]>,
  ) => Promise<FilterPreset>;
  updatePreset: (
    id: string,
    data: Partial<Pick<FilterPreset, "name" | "filters">>,
  ) => Promise<FilterPreset>;
  deletePreset: (id: string) => Promise<void>;
}

export function useFilterPresets(
  context: FilterPresetContext,
): UseFilterPresetsReturn {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/filter-presets?context=${context}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch presets");
      }
      setPresets(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [context]);

  const createPreset = useCallback(
    async (name: string, filters: Record<string, string | string[]>) => {
      const res = await offlineFetch("/api/filter-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, context, filters }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create preset");
      }
      const created: FilterPreset = await res.json();
      setPresets((prev) => [...prev, created]);
      return created;
    },
    [context],
  );

  const updatePreset = useCallback(
    async (
      id: string,
      data: Partial<Pick<FilterPreset, "name" | "filters">>,
    ) => {
      const res = await offlineFetch(`/api/filter-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update preset");
      }
      const updated: FilterPreset = await res.json();
      setPresets((prev) => prev.map((p) => (p._id === id ? updated : p)));
      return updated;
    },
    [],
  );

  const deletePreset = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/filter-presets/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete preset");
    }
    setPresets((prev) => prev.filter((p) => p._id !== id));
  }, []);

  useSyncSubscription(
    "filter-preset",
    useCallback(
      (event: SyncEvent) => {
        const data = event.data as FilterPreset | undefined;

        switch (event.action) {
          case "created":
            if (!data || data.context !== context) return;
            setPresets((prev) => {
              if (prev.some((p) => p._id === data._id)) return prev;
              return [...prev, data];
            });
            break;
          case "updated":
            if (!data) return;
            setPresets((prev) =>
              prev.map((p) => (p._id === event.entityId ? data : p)),
            );
            break;
          case "deleted":
            setPresets((prev) => prev.filter((p) => p._id !== event.entityId));
            break;
        }
      },
      [context],
    ),
  );

  return {
    presets,
    loading,
    error,
    fetchPresets,
    createPreset,
    updatePreset,
    deletePreset,
  };
}
