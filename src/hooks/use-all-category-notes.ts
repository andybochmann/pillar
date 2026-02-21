"use client";

import { useState, useCallback } from "react";
import { useSyncSubscription } from "./use-sync-subscription";
import type { Note } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

interface UseAllCategoryNotesReturn {
  notesByCategoryId: Record<string, Note[]>;
  fetchAll: () => Promise<void>;
}

export function useAllCategoryNotes(): UseAllCategoryNotesReturn {
  const [notesByCategoryId, setNotesByCategoryId] = useState<Record<string, Note[]>>({});

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/notes?parentType=category");
      if (!res.ok) return;
      const notes: Note[] = await res.json();
      const grouped: Record<string, Note[]> = {};
      for (const note of notes) {
        if (!note.categoryId) continue;
        if (!grouped[note.categoryId]) grouped[note.categoryId] = [];
        grouped[note.categoryId].push(note);
      }
      setNotesByCategoryId(grouped);
    } catch {
      // silently fail
    }
  }, []);

  useSyncSubscription(
    "note",
    useCallback((event: SyncEvent) => {
      const data = event.data as Note | undefined;

      switch (event.action) {
        case "created":
          if (!data || data.parentType !== "category" || !data.categoryId) return;
          setNotesByCategoryId((prev) => {
            const catId = data.categoryId!;
            const existing = prev[catId] ?? [];
            if (existing.some((n) => n._id === data._id)) return prev;
            return { ...prev, [catId]: [...existing, data] };
          });
          break;
        case "updated":
          if (!data || data.parentType !== "category" || !data.categoryId) return;
          setNotesByCategoryId((prev) => {
            const newState = { ...prev };
            for (const catId of Object.keys(newState)) {
              newState[catId] = newState[catId].map((n) =>
                n._id === event.entityId ? data : n,
              );
            }
            return newState;
          });
          break;
        case "deleted":
          setNotesByCategoryId((prev) => {
            const newState = { ...prev };
            for (const catId of Object.keys(newState)) {
              newState[catId] = newState[catId].filter((n) => n._id !== event.entityId);
            }
            return newState;
          });
          break;
      }
    }, []),
  );

  return { notesByCategoryId, fetchAll };
}
