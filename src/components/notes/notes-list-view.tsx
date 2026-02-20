"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteList } from "./note-list";
import { NoteEditorDialog } from "./note-editor-dialog";
import { useNotes } from "@/hooks/use-notes";
import { toast } from "sonner";
import type { Note, NoteParentType } from "@/types";

interface NotesListViewProps {
  parentType: NoteParentType;
  categoryId?: string;
  projectId?: string;
  taskId?: string;
}

export function NotesListView({
  parentType,
  categoryId,
  projectId,
  taskId,
}: NotesListViewProps) {
  const {
    notes,
    loading,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  } = useNotes({ parentType, categoryId, projectId, taskId });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Notes
          {notes.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({notes.length})
            </span>
          )}
        </h2>
        <Button size="sm" onClick={handleNew} className="gap-1">
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading notes...
        </p>
      ) : (
        <NoteList
          notes={notes}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
        />
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
