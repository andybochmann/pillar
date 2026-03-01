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
  onSaveStatusChange?: (status: "saving" | "saved") => void;
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
      // Flush unsaved title
      const trimmed = titleRef.current.trim();
      if (trimmed && trimmed !== initialTitleRef.current) {
        onUpdateRef.current({ title: trimmed });
      }
      // Flush unsaved description
      if (descriptionRef.current !== initialDescriptionRef.current) {
        onUpdateRef.current({ description: descriptionRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  function saveField(data: { title?: string; description?: string }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSaveStatusChange?.("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        await onUpdate(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        onSaveStatusChange?.("saved");
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

  function handleTitleBlur() {
    saveTitleIfChanged();
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleDescriptionBlur() {
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
          onBlur={handleDescriptionBlur}
          placeholder="Add a description…"
          rows={3}
        />
      </div>
    </>
  );
}
