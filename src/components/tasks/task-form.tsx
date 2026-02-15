"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="space-y-2">
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
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          size="sm"
          aria-label="Cancel task creation"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!title.trim() || submitting}
          size="sm"
          aria-label="Submit task"
        >
          <Check className="h-4 w-4 mr-1.5" />
          {submitting ? "Adding…" : "Add Task"}
        </Button>
      </div>
    </form>
  );
}
