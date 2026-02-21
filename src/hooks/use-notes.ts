"use client";

import { useState, useCallback } from "react";
import { offlineFetch } from "@/lib/offline-fetch";
import { useSyncSubscription } from "./use-sync-subscription";
import type { Note, NoteParentType } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

interface UseNotesOptions {
  parentType: NoteParentType;
  categoryId?: string;
  projectId?: string;
  taskId?: string;
}

interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  createNote: (data: { title: string; content?: string; pinned?: boolean }) => Promise<Note>;
  updateNote: (id: string, data: Partial<Pick<Note, "title" | "content" | "pinned" | "order">>) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string, currentPinned: boolean) => Promise<Note>;
}

export function useNotes({ parentType, categoryId, projectId, taskId }: UseNotesOptions): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (parentType === "category" && categoryId) {
      params.set("categoryId", categoryId);
    } else if (parentType === "project" && projectId) {
      params.set("projectId", projectId);
      params.set("parentType", "project");
    } else if (parentType === "task" && taskId) {
      params.set("taskId", taskId);
    }
    const qs = params.toString();
    if (!qs) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/notes?${qs}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch notes");
      }
      setNotes(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [parentType, categoryId, projectId, taskId]);

  const createNote = useCallback(
    async (data: { title: string; content?: string; pinned?: boolean }) => {
      const body: Record<string, unknown> = {
        ...data,
        parentType,
      };
      if (categoryId) body.categoryId = categoryId;
      if (projectId) body.projectId = projectId;
      if (taskId) body.taskId = taskId;

      const res = await offlineFetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const respBody = await res.json();
        throw new Error(respBody.error || "Failed to create note");
      }
      const created: Note = await res.json();
      setNotes((prev) => [...prev, created]);
      return created;
    },
    [parentType, categoryId, projectId, taskId],
  );

  const updateNote = useCallback(
    async (id: string, data: Partial<Pick<Note, "title" | "content" | "pinned" | "order">>) => {
      const res = await offlineFetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update note");
      }
      const updated: Note = await res.json();
      setNotes((prev) => prev.map((n) => (n._id === id ? updated : n)));
      return updated;
    },
    [],
  );

  const deleteNote = useCallback(async (id: string) => {
    const res = await offlineFetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete note");
    }
    setNotes((prev) => prev.filter((n) => n._id !== id));
  }, []);

  const togglePin = useCallback(
    async (id: string, currentPinned: boolean) => {
      return updateNote(id, { pinned: !currentPinned });
    },
    [updateNote],
  );

  // Real-time sync subscription
  useSyncSubscription(
    "note",
    useCallback(
      (event: SyncEvent) => {
        const data = event.data as Note | undefined;

        switch (event.action) {
          case "created":
            if (!data) return;
            // Only add if it belongs to our current view
            if (parentType === "category" && data.categoryId !== categoryId) return;
            if (parentType === "project" && (data.projectId !== projectId || data.parentType !== "project")) return;
            if (parentType === "task" && data.taskId !== taskId) return;
            setNotes((prev) => {
              if (prev.some((n) => n._id === data._id)) return prev;
              return [...prev, data];
            });
            break;
          case "updated":
            if (!data) return;
            setNotes((prev) => prev.map((n) => (n._id === event.entityId ? data : n)));
            break;
          case "deleted":
            setNotes((prev) => prev.filter((n) => n._id !== event.entityId));
            break;
        }
      },
      [parentType, categoryId, projectId, taskId],
    ),
  );

  return {
    notes,
    loading,
    error,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  };
}
