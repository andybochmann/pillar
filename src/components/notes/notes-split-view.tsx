"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownEditor } from "./markdown-editor";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useNotes } from "@/hooks/use-notes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Note, NoteParentType } from "@/types";

// ─── Right-panel inline editor ────────────────────────────────────────────────

interface NoteEditorPanelProps {
  note: Note;
  onUpdate: (id: string, data: Partial<Pick<Note, "title" | "content" | "pinned">>) => Promise<Note>;
  onDelete: (id: string) => Promise<void>;
  onBackToList: () => void;
}

function NoteEditorPanel({ note, onUpdate, onDelete, onBackToList }: NoteEditorPanelProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content ?? "");
  const [pinned, setPinned] = useState(note.pinned);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingRef = useRef<Partial<Pick<Note, "title" | "content" | "pinned">>>({});
  // Keep stable ref to onUpdate so the unmount flush uses the current version
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  const scheduleSave = useCallback(
    (data: Partial<Pick<Note, "title" | "content" | "pinned">>) => {
      Object.assign(pendingRef.current, data);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus("saving");
      debounceRef.current = setTimeout(() => {
        const merged = { ...pendingRef.current };
        pendingRef.current = {};
        onUpdateRef.current(note._id, merged)
          .then(() => setSaveStatus("saved"))
          .catch((err) => {
            toast.error(err instanceof Error ? err.message : "Failed to save");
            setSaveStatus("saved");
          });
      }, 500);
    },
    [note._id],
  );

  // Flush pending changes when unmounting (note switch or component teardown)
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const pending = { ...pendingRef.current };
      if (Object.keys(pending).length > 0) {
        onUpdateRef.current(note._id, pending).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTogglePin() {
    const next = !pinned;
    setPinned(next);
    try {
      await onUpdate(note._id, { pinned: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setPinned(!next);
    }
  }

  async function handleDelete() {
    try {
      await onDelete(note._id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="gap-1 md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            Notes
          </Button>
          <span
            className={cn(
              "text-xs text-muted-foreground",
              saveStatus === "saving" && "text-orange-500",
            )}
          >
            {saveStatus === "saving" ? "Saving…" : "Saved"}
          </span>
        </div>
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

      {/* Title */}
      <div className="shrink-0 px-6 pt-5">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave({ title: e.target.value });
          }}
          placeholder="Note title"
          maxLength={200}
          className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6 pt-4">
        <MarkdownEditor
          value={content}
          onChange={(val) => {
            setContent(val);
            scheduleSave({ content: val });
          }}
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

// ─── Split view ───────────────────────────────────────────────────────────────

interface NotesSplitViewProps {
  parentType: NoteParentType;
  categoryId?: string;
  projectId?: string;
  taskId?: string;
  /** Pre-select a specific note on mount (e.g. from a sidebar link). */
  initialNoteId?: string;
  /** If provided, a back link is shown at the top of the left panel. */
  backHref?: string;
  backLabel?: string;
}

export function NotesSplitView({
  parentType,
  categoryId,
  projectId,
  taskId,
  initialNoteId,
  backHref,
  backLabel,
}: NotesSplitViewProps) {
  const { notes, loading, fetchNotes, createNote, updateNote, deleteNote } =
    useNotes({ parentType, categoryId, projectId, taskId });

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    initialNoteId ?? null,
  );

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Honour URL-driven pre-selection (e.g. navigating from sidebar)
  useEffect(() => {
    if (initialNoteId !== undefined) setSelectedNoteId(initialNoteId);
  }, [initialNoteId]);

  const selectedNote = notes.find((n) => n._id === selectedNoteId) ?? null;

  async function handleCreate() {
    try {
      const created = await createNote({ title: "Untitled Note" });
      setSelectedNoteId(created._id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create note");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNote(id);
      toast.success("Note deleted");
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: note list ── */}
      <div
        className={cn(
          "flex w-64 shrink-0 flex-col border-r",
          // On mobile: hide list when a note is open, show otherwise
          selectedNoteId ? "hidden md:flex" : "flex",
        )}
      >
        {backHref && backLabel && (
          <div className="shrink-0 border-b px-3 py-2">
            <Link
              href={backHref}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notes</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCreate}
            aria-label="New note"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : notes.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <StickyNote className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">No notes yet.</p>
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs"
                onClick={handleCreate}
              >
                Create the first one
              </Button>
            </div>
          ) : (
            <div className="py-1">
              {notes.map((note) => (
                <button
                  key={note._id}
                  type="button"
                  onClick={() => setSelectedNoteId(note._id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent",
                    selectedNoteId === note._id
                      ? "bg-primary/10 text-primary"
                      : "text-foreground",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {note.pinned && (
                      <Pin className="h-3 w-3 shrink-0 text-primary" />
                    )}
                    <span className="truncate text-sm font-medium">
                      {note.title || "Untitled"}
                    </span>
                  </div>
                  {note.content && (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {note.content.replace(/[#*`>_~[\]!-]/g, "").trim()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right panel: editor or empty state ── */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          !selectedNoteId && "hidden md:flex",
        )}
      >
        {selectedNote ? (
          <NoteEditorPanel
            key={selectedNote._id}
            note={selectedNote}
            onUpdate={updateNote}
            onDelete={handleDelete}
            onBackToList={() => setSelectedNoteId(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <StickyNote className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a note to start editing</p>
            <Button variant="outline" size="sm" onClick={handleCreate} className="gap-1">
              <Plus className="h-4 w-4" />
              New Note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
