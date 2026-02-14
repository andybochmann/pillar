"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface TaskFormProps {
  onSubmit: (title: string) => Promise<void>;
  onCancel: () => void;
}

export function TaskForm({ onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(title.trim());
      setTitle("");
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title…"
        disabled={submitting}
        aria-label="New task title"
        className="text-sm"
      />
    </form>
  );
}
