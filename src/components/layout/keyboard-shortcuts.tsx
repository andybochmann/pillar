"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBackButton } from "@/hooks/use-back-button";

const shortcuts = [
  { key: "/", description: "Open search" },
  { key: "n", description: "Create new task (in current board)" },
  { key: "?", description: "Show keyboard shortcuts" },
  { key: "Escape", description: "Close dialog / sheet / search" },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useBackButton("keyboard-shortcuts", open, () => setOpen(false));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Available keyboard shortcuts for quick navigation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-muted-foreground">
                {s.description}
              </span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
