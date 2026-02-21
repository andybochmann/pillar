"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pin, PinOff, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";

interface NoteListProps {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\[.?\]\s*/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

export function NoteList({ notes, onEdit, onDelete, onTogglePin }: NoteListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (notes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No notes yet
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note._id}
            role="button"
            tabIndex={0}
            onClick={() => onEdit(note)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onEdit(note);
            }}
            className={cn(
              "group flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
              note.pinned && "border-primary/30 bg-primary/5",
            )}
          >
            <div className="flex w-full items-center gap-2">
              {note.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
              <span className="truncate text-sm font-medium">{note.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onEdit(note)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onTogglePin(note._id, note.pinned)}>
                    {note.pinned ? (
                      <PinOff className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Pin className="mr-2 h-3.5 w-3.5" />
                    )}
                    {note.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(note._id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {note.content && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {stripMarkdown(note.content).slice(0, 200)}
              </p>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) onDelete(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
