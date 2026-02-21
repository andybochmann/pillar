"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "./markdown-editor";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { offlineFetch } from "@/lib/offline-fetch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";

interface NotePageEditorProps {
  initialNote: Note;
  categoryId: string;
  categoryName: string;
}

export function NotePageEditor({
  initialNote,
  categoryId,
  categoryName,
}: NotePageEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialNote.title);
  const [content, setContent] = useState(initialNote.content);
  const [pinned, setPinned] = useState(initialNote.pinned);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingRef = useRef<Partial<Pick<Note, "title" | "content" | "pinned">>>({});

  const save = useCallback(
    async (data: Partial<Pick<Note, "title" | "content" | "pinned">>) => {
      try {
        const res = await offlineFetch(`/api/notes/${initialNote._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to save");
        }
        setSaveStatus("saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
        setSaveStatus("saved");
      }
    },
    [initialNote._id],
  );

  const scheduleSave = useCallback(
    (data: Partial<Pick<Note, "title" | "content" | "pinned">>) => {
      Object.assign(pendingRef.current, data);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus("saving");
      const merged = { ...pendingRef.current };
      debounceRef.current = setTimeout(async () => {
        pendingRef.current = {};
        await save(merged);
      }, 500);
    },
    [save],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave({ title: value });
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave({ content: value });
  }

  async function handleTogglePin() {
    const newPinned = !pinned;
    setPinned(newPinned);
    await save({ pinned: newPinned });
  }

  async function handleDelete() {
    try {
      const res = await offlineFetch(`/api/notes/${initialNote._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete note");
      }
      toast.success("Note deleted");
      router.push(`/categories/${categoryId}/notes`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <Link
          href={`/categories/${categoryId}/notes`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {categoryName} Notes
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs text-muted-foreground",
              saveStatus === "saving" && "text-orange-500",
            )}
          >
            {saveStatus === "saving" ? "Saving…" : "Saved"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTogglePin}
            aria-label={pinned ? "Unpin note" : "Pin note"}
            className={cn("h-8 w-8", pinned && "text-primary")}
          >
            <Pin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete note"
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="px-6 pt-6">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          maxLength={200}
          className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        <MarkdownEditor
          value={content}
          onChange={handleContentChange}
          height={600}
          placeholder="Write your note in Markdown…"
        />
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Note"
        description={`This will permanently delete "${title}". This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
