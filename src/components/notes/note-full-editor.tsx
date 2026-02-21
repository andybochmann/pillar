"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "./markdown-editor";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { offlineFetch } from "@/lib/offline-fetch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";

interface NoteFullEditorProps {
  initialNote: Note;
  categoryId: string;
}

export function NoteFullEditor({ initialNote, categoryId }: NoteFullEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialNote.title);
  const [content, setContent] = useState(initialNote.content ?? "");
  const [pinned, setPinned] = useState(initialNote.pinned);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingRef = useRef<Partial<Pick<Note, "title" | "content" | "pinned">>>({});

  const flush = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const pending = { ...pendingRef.current };
    pendingRef.current = {};
    if (Object.keys(pending).length === 0) return;
    try {
      await offlineFetch(`/api/notes/${initialNote._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      setSaveStatus("saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setSaveStatus("saved");
    }
  }, [initialNote._id]);

  // Flush on unmount
  useEffect(() => () => { void flush(); }, [flush]);

  const scheduleSave = useCallback(
    (data: Partial<Pick<Note, "title" | "content" | "pinned">>) => {
      Object.assign(pendingRef.current, data);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus("saving");
      debounceRef.current = setTimeout(() => { void flush(); }, 500);
    },
    [flush],
  );

  async function handleTogglePin() {
    const next = !pinned;
    setPinned(next);
    try {
      await offlineFetch(`/api/notes/${initialNote._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setPinned(!next);
    }
  }

  async function handleDelete() {
    try {
      await offlineFetch(`/api/notes/${initialNote._id}`, { method: "DELETE" });
      toast.success("Note deleted");
      router.push(`/categories/${categoryId}/notes`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span
          className={cn(
            "text-xs text-muted-foreground",
            saveStatus === "saving" && "text-orange-500",
          )}
        >
          {saveStatus === "saving" ? "Saving…" : "Saved"}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTogglePin}
            aria-label={pinned ? "Unpin note" : "Pin note"}
            className={cn("h-7 w-7", pinned && "text-primary")}
          >
            <Pin className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete note"
            className="h-7 w-7 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-auto px-8 pb-8 pt-6">
        <div className="mx-auto max-w-3xl">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave({ title: e.target.value });
            }}
            placeholder="Note title"
            maxLength={200}
            className="mb-4 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground"
          />
          <MarkdownEditor
            key={initialNote._id}
            value={content}
            onChange={(val) => {
              setContent(val);
              scheduleSave({ content: val });
            }}
            placeholder="Write your note…"
          />
        </div>
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
