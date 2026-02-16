"use client";

import { useState, useEffect, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Label } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

const sortByName = (a: Label, b: Label) => a.name.localeCompare(b.name);

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

/**
 * Manages label state with CRUD operations, real-time synchronization, and offline support.
 *
 * This hook provides a complete interface for managing labels (task tags), including:
 * - Automatic fetching of labels on mount
 * - Local state management with optimistic updates and auto-sorting by name
 * - Real-time synchronization via Server-Sent Events (SSE)
 * - Offline mutation queuing via offlineFetch
 * - Automatic refetch on network reconnection
 *
 * @returns {UseLabelsReturn} Object containing:
 *   - `labels`: Array of labels sorted alphabetically by name
 *   - `loading`: Boolean indicating if a fetch operation is in progress
 *   - `error`: Error message string or null
 *   - `createLabel`: Function to create a new label with optimistic update
 *   - `updateLabel`: Function to update a label with optimistic update
 *   - `deleteLabel`: Function to delete a label with optimistic update
 *   - `refresh`: Function to manually refetch labels
 *
 * @example
 * ```tsx
 * function LabelManager() {
 *   const {
 *     labels,
 *     loading,
 *     error,
 *     createLabel,
 *     updateLabel,
 *     deleteLabel
 *   } = useLabels();
 *
 *   const handleCreateLabel = async () => {
 *     try {
 *       await createLabel({
 *         name: "urgent",
 *         color: "#ef4444"
 *       });
 *     } catch (err) {
 *       toast.error((err as Error).message);
 *     }
 *   };
 *
 *   const handleUpdateLabel = async (labelId: string) => {
 *     await updateLabel(labelId, { color: "#10b981" });
 *   };
 *
 *   if (loading) return <Spinner />;
 *   return <div>{labels.map(l => <LabelBadge key={l._id} label={l} />)}</div>;
 * }
 * ```
 *
 * @remarks
 * **Side Effects:**
 * - Automatically fetches all labels on component mount
 * - Subscribes to real-time label events (created, updated, deleted) via SSE
 * - Automatically refetches labels on network reconnection
 * - All mutations use `offlineFetch` to queue operations when offline
 * - Labels are always sorted alphabetically by name after any state change
 * - Optimistic updates are applied immediately; SSE events reconcile state across tabs/users
 */
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
      setLabels((prev) => [...prev, created].sort(sortByName));
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
          .sort(sortByName),
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

  // Real-time sync subscription
  useSyncSubscription("label", useCallback((event: SyncEvent) => {
    const data = event.data as Label | undefined;

    switch (event.action) {
      case "created":
        if (!data) return;
        setLabels((prev) => {
          if (prev.some((l) => l._id === data._id)) return prev;
          return [...prev, data].sort(sortByName);
        });
        break;
      case "updated":
        if (!data) return;
        setLabels((prev) =>
          prev
            .map((l) => (l._id === event.entityId ? data : l))
            .sort(sortByName),
        );
        break;
      case "deleted":
        setLabels((prev) => prev.filter((l) => l._id !== event.entityId));
        break;
    }
  }, []));

  useRefetchOnReconnect(fetchLabels);

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
