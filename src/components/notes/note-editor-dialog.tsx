"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MarkdownEditor } from "./markdown-editor";
import { toast } from "sonner";
import type { Note } from "@/types";

interface NoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: Note | null;
  onCreate?: (data: { title: string; content?: string; pinned?: boolean }) => Promise<Note>;
  onUpdate?: (id: string, data: Partial<Pick<Note, "title" | "content" | "pinned">>) => Promise<Note>;
  /** Called with the new note after creation instead of closing the dialog. */
  onCreated?: (note: Note) => void;
}

export function NoteEditorDialog({
  open,
  onOpenChange,
  note,
  onCreate,
  onUpdate,
  onCreated,
}: NoteEditorDialogProps) {
  const isEdit = !!note;
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingRef = useRef<Partial<Pick<Note, "title" | "content" | "pinned">>>({});

  // Reset form when dialog opens or note changes
  useEffect(() => {
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    setPinned(note?.pinned ?? false);
  }, [open, note]);

  const flushPending = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const pending = { ...pendingRef.current };
    pendingRef.current = {};
    if (note && onUpdate && Object.keys(pending).length > 0) {
      onUpdate(note._id, pending).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      });
    }
  }, [note, onUpdate]);

  const autoSave = useCallback(
    (data: Partial<Pick<Note, "title" | "content" | "pinned">>) => {
      if (!note || !onUpdate) return;
      Object.assign(pendingRef.current, data);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const merged = { ...pendingRef.current };
      debounceRef.current = setTimeout(async () => {
        pendingRef.current = {};
        try {
          await onUpdate(note._id, merged);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to save");
        }
      }, 500);
    },
    [note, onUpdate],
  );

  // Flush pending auto-save on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    autoSave({ title: value });
  }

  function handleContentChange(value: string) {
    setContent(value);
    autoSave({ content: value });
  }

  function handlePinnedChange(value: boolean) {
    setPinned(value);
    autoSave({ pinned: value });
  }

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!onCreate) return;

    setSaving(true);
    try {
      const created = await onCreate({ title: title.trim(), content, pinned });
      toast.success("Note created");
      if (onCreated) {
        onCreated(created);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) flushPending();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Note" : "New Note"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edit note details" : "Create a new note"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Note title"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <MarkdownEditor
              key={note?._id ?? "new"}
              value={content}
              onChange={handleContentChange}
              height={300}
              placeholder="Write your note in Markdown..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="note-pinned"
              checked={pinned}
              onCheckedChange={handlePinnedChange}
            />
            <Label htmlFor="note-pinned" className="cursor-pointer">
              Pin note
            </Label>
          </div>

          {!isEdit && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving || !title.trim()}>
                {saving ? "Creating..." : "Create Note"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
