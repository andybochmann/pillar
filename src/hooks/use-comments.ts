"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import { useRefetchOnReconnect } from "./use-refetch-on-reconnect";
import type { Comment } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  fetchComments: () => Promise<void>;
  addComment: (data: { body: string; mentions?: string[] }) => Promise<Comment>;
  deleteComment: (id: string) => Promise<void>;
}

/**
 * Manages the comment thread for a single task with optimistic updates,
 * real-time synchronization (SSE), and offline support.
 *
 * - GET requests use plain `fetch`
 * - Mutations use `offlineFetch` so they queue while offline
 * - Subscribes to `comment` sync events to live-update across tabs/users
 * - Refetches on reconnect to reconcile anything missed while offline
 */
export function useComments(taskId: string): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch comments");
      }
      setComments(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const addComment = useCallback(
    async (data: { body: string; mentions?: string[] }) => {
      const res = await offlineFetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const respBody = await res.json();
        throw new Error(respBody.error || "Failed to add comment");
      }
      const created: Comment = await res.json();
      // An offline mutation echoes only the request fields (no createdAt), so
      // stamp one to keep the optimistic render valid until reconnect reconciles.
      const optimistic: Comment = created.createdAt
        ? created
        : { ...created, createdAt: new Date().toISOString() };
      setComments((prev) =>
        prev.some((c) => c._id === optimistic._id)
          ? prev
          : [...prev, optimistic],
      );
      return optimistic;
    },
    [taskId],
  );

  const deleteComment = useCallback(
    async (id: string) => {
      const res = await offlineFetch(`/api/tasks/${taskId}/comments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete comment");
      }
      setComments((prev) => prev.filter((c) => c._id !== id));
    },
    [taskId],
  );

  // Real-time sync subscription
  useSyncSubscription(
    "comment",
    useCallback(
      (event: SyncEvent) => {
        const data = event.data as Comment | undefined;
        switch (event.action) {
          case "created":
            if (!data || data.taskId !== taskId) return;
            setComments((prev) =>
              prev.some((c) => c._id === data._id) ? prev : [...prev, data],
            );
            break;
          case "deleted":
            setComments((prev) => prev.filter((c) => c._id !== event.entityId));
            break;
        }
      },
      [taskId],
    ),
  );

  useRefetchOnReconnect(fetchComments);

  return {
    comments,
    loading,
    error,
    fetchComments,
    addComment,
    deleteComment,
  };
}
