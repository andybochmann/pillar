"use client";

import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TaskTitleDescriptionSectionProps {
  taskId: string;
  initialTitle: string;
  initialDescription: string;
  onUpdate: (data: {
    title?: string;
    description?: string;
  }) => Promise<unknown>;
  onSaveStatusChange?: (status: "saving" | "saved" | "error") => void;
}

export function TaskTitleDescriptionSection({
  taskId,
  initialTitle,
  initialDescription,
  onUpdate,
  onSaveStatusChange,
}: TaskTitleDescriptionSectionProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track focus and the last value we synced from props so an external
  // (SSE / prop) update never clobbers what the user is actively editing.
  // The debounce timer only starts on blur, so guarding on it left the field
  // unprotected mid-keystroke.
  const titleFocusedRef = useRef(false);
  const descriptionFocusedRef = useRef(false);
  const lastSyncedTitleRef = useRef(initialTitle);
  const lastSyncedDescriptionRef = useRef(initialDescription);

  // Sync local state from props (SSE updates) only when the field is neither
  // focused nor dirty (has unsaved local edits).
  useEffect(() => {
    const dirty = title !== lastSyncedTitleRef.current;
    if (!titleFocusedRef.current && !dirty) {
      setTitle(initialTitle);
    }
    lastSyncedTitleRef.current = initialTitle;
  }, [initialTitle, title]);

  useEffect(() => {
    const dirty = description !== lastSyncedDescriptionRef.current;
    if (!descriptionFocusedRef.current && !dirty) {
      setDescription(initialDescription);
    }
    lastSyncedDescriptionRef.current = initialDescription;
  }, [initialDescription, description]);

  // Refs to track latest values for the cleanup effect
  const titleRef = useRef(title);
  const descriptionRef = useRef(description);
  const initialTitleRef = useRef(initialTitle);
  const initialDescriptionRef = useRef(initialDescription);
  const onUpdateRef = useRef(onUpdate);

  // Keep refs in sync with latest values
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);
  useEffect(() => {
    initialTitleRef.current = initialTitle;
  }, [initialTitle]);
  useEffect(() => {
    initialDescriptionRef.current = initialDescription;
  }, [initialDescription]);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Flush unsaved changes on unmount or task change
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Flush unsaved title and description as a single update
      const trimmed = titleRef.current.trim();
      const titleDirty = !!trimmed && trimmed !== initialTitleRef.current;
      const descDirty = descriptionRef.current !== initialDescriptionRef.current;
      if (titleDirty || descDirty) {
        const update: { title?: string; description?: string } = {};
        if (titleDirty) update.title = trimmed;
        if (descDirty) update.description = descriptionRef.current;
        onUpdateRef.current(update);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  function saveField(data: { title?: string; description?: string }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSaveStatusChange?.("saving");
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      try {
        await onUpdate(data);
        onSaveStatusChange?.("saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
        onSaveStatusChange?.("error");
      }
    }, 500);
  }

  function saveTitleIfChanged() {
    if (title.trim() === initialTitle) return;
    if (!title.trim()) {
      setTitle(initialTitle);
      return;
    }
    saveField({ title: title.trim() });
  }

  function handleTitleFocus() {
    titleFocusedRef.current = true;
  }

  function handleTitleBlur() {
    titleFocusedRef.current = false;
    saveTitleIfChanged();
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleDescriptionFocus() {
    descriptionFocusedRef.current = true;
  }

  function handleDescriptionBlur() {
    descriptionFocusedRef.current = false;
    if (description === initialDescription) return;
    saveField({ description });
  }

  return (
    <>
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={handleTitleFocus}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="text-lg font-semibold"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onFocus={handleDescriptionFocus}
          onBlur={handleDescriptionBlur}
          placeholder="Add a description…"
          rows={3}
        />
      </div>
    </>
  );
}
