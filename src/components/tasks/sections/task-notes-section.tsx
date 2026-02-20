"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NoteList } from "@/components/notes/note-list";
import { NoteEditorDialog } from "@/components/notes/note-editor-dialog";
import { useNotes } from "@/hooks/use-notes";
import { toast } from "sonner";
import type { Note } from "@/types";

interface TaskNotesSectionProps {
  taskId: string;
  projectId: string;
}

export function TaskNotesSection({ taskId, projectId }: TaskNotesSectionProps) {
  const {
    notes,
    loading,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  } = useNotes({ parentType: "task", taskId, projectId });

  const [expanded, setExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    if (expanded) fetchNotes();
  }, [expanded, fetchNotes]);

  function handleEdit(note: Note) {
    setEditingNote(note);
    setEditorOpen(true);
  }

  function handleNew() {
    setEditingNote(null);
    setEditorOpen(true);
  }

  async function handleDelete(id: string) {
    try {
      await deleteNote(id);
      toast.success("Note deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  async function handleTogglePin(id: string, currentPinned: boolean) {
    try {
      await togglePin(id, currentPinned);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update note");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <StickyNote className="h-4 w-4 text-muted-foreground" />
        <Label className="cursor-pointer">
          Notes
          {notes.length > 0 && (
            <span className="ml-1 text-muted-foreground">({notes.length})</span>
          )}
        </Label>
      </button>

      {expanded && (
        <div className="space-y-2 pl-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNew}
            className="w-full gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Note
          </Button>

          {loading ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Loading...
            </p>
          ) : (
            <NoteList
              notes={notes}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          )}
        </div>
      )}

      <NoteEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingNote(null);
        }}
        note={editingNote}
        onCreate={createNote}
        onUpdate={updateNote}
      />
    </div>
  );
}
