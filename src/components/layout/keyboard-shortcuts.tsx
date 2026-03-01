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

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const modKey = isMac ? "\u2318" : "Ctrl";

interface ShortcutGroup {
  label: string;
  shortcuts: { key: string; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    label: "Global",
    shortcuts: [
      { key: "/", description: "Open search" },
      { key: "n", description: "Create new task (in current board)" },
      { key: `${modKey}+Shift+N`, description: "Create new project" },
      { key: "?", description: "Show keyboard shortcuts" },
      { key: "Escape", description: "Close dialog / sheet / search" },
    ],
  },
  {
    label: "Kanban Board",
    shortcuts: [
      { key: "j", description: "Move focus to next task" },
      { key: "k", description: "Move focus to previous task" },
      { key: "e / Enter", description: "Open focused task" },
      { key: "d", description: "Open date picker" },
      { key: "p", description: "Cycle priority" },
      { key: "c", description: "Toggle complete" },
      { key: "x", description: "Toggle selection" },
    ],
  },
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

      // Ctrl+Shift+N / Cmd+Shift+N: create new project
      if (e.key === "N" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("pillar:open-create-project"));
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
        <div className="space-y-4">
          {shortcutGroups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-muted-foreground">
                      {s.description}
                    </span>
                    <div className="flex gap-1">
                      {s.key.split("+").map((part, i) => (
                        <kbd
                          key={i}
                          className="rounded border bg-muted px-2 py-0.5 text-xs font-mono"
                        >
                          {part.trim()}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
