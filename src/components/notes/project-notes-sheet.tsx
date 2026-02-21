"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NoteList } from "./note-list";
import { NoteEditorDialog } from "./note-editor-dialog";
import { useNotes } from "@/hooks/use-notes";
import { useBackButton } from "@/hooks/use-back-button";
import { toast } from "sonner";
import type { Note } from "@/types";

interface ProjectNotesSheetProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectNotesSheet({
  projectId,
  open,
  onOpenChange,
}: ProjectNotesSheetProps) {
  const {
    notes,
    loading,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  } = useNotes({ parentType: "project", projectId });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useBackButton("project-notes-sheet", open, () => onOpenChange(false));

  useEffect(() => {
    if (open) fetchNotes();
  }, [open, fetchNotes]);

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
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Project Notes</SheetTitle>
            <SheetDescription className="sr-only">
              View and manage notes for this project
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4 px-4 pb-4">
            <Button size="sm" onClick={handleNew} className="w-full gap-1">
              <Plus className="h-4 w-4" />
              New Note
            </Button>

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
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  );
}
