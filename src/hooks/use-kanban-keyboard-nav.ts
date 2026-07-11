"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Task, Column } from "@/types";

interface UseKanbanKeyboardNavOptions {
  tasks: Task[];
  columns: Column[];
  onOpenTask: (taskId: string) => void;
  onCyclePriority: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleSelect: (taskId: string) => void;
  onOpenDatePicker: (taskId: string) => void;
  disabled?: boolean;
}

function isInputTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function isDialogOpen(): boolean {
  return document.querySelector("[role='dialog']") !== null;
}

export function useKanbanKeyboardNav({
  tasks,
  columns,
  onOpenTask,
  onCyclePriority,
  onToggleComplete,
  onToggleSelect,
  onOpenDatePicker,
  disabled,
}: UseKanbanKeyboardNavOptions) {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  // Mirror focus in a ref so key handlers can read the current value without
  // running side effects inside the setState updater (which React's StrictMode
  // and the React Compiler may double-invoke, causing double PATCHes).
  const focusedTaskIdRef = useRef<string | null>(focusedTaskId);
  useEffect(() => {
    focusedTaskIdRef.current = focusedTaskId;
  }, [focusedTaskId]);

  // Build a flat ordered list of task IDs following column order
  const orderedTaskIds = useMemo(() => {
    const sortedCols = [...columns].sort((a, b) => a.order - b.order);
    const ids: string[] = [];
    for (const col of sortedCols) {
      const colTasks = tasks
        .filter((t) => t.columnId === col.id)
        .sort((a, b) => a.order - b.order);
      for (const t of colTasks) {
        ids.push(t._id);
      }
    }
    return ids;
  }, [tasks, columns]);

  const moveNext = useCallback(() => {
    if (orderedTaskIds.length === 0) return;
    setFocusedTaskId((current) => {
      if (current === null) return orderedTaskIds[0];
      const idx = orderedTaskIds.indexOf(current);
      if (idx === -1) return orderedTaskIds[0];
      return orderedTaskIds[(idx + 1) % orderedTaskIds.length];
    });
  }, [orderedTaskIds]);

  const movePrev = useCallback(() => {
    if (orderedTaskIds.length === 0) return;
    setFocusedTaskId((current) => {
      if (current === null) return orderedTaskIds[orderedTaskIds.length - 1];
      const idx = orderedTaskIds.indexOf(current);
      if (idx === -1) return orderedTaskIds[orderedTaskIds.length - 1];
      return orderedTaskIds[
        (idx - 1 + orderedTaskIds.length) % orderedTaskIds.length
      ];
    });
  }, [orderedTaskIds]);

  useEffect(() => {
    if (disabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputTarget(e)) return;
      if (isDialogOpen()) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          moveNext();
          break;
        case "k":
          e.preventDefault();
          movePrev();
          break;
        case "Escape":
          setFocusedTaskId(null);
          break;
        // Action shortcuts read the focused id from the ref and invoke callbacks
        // OUTSIDE any state updater, so a double-invoked updater can't fire them
        // twice (double PATCH / priority skipping two steps).
        case "Enter":
        case "e": {
          const current = focusedTaskIdRef.current;
          if (current) onOpenTask(current);
          break;
        }
        case "p": {
          const current = focusedTaskIdRef.current;
          if (current) onCyclePriority(current);
          break;
        }
        case "c": {
          const current = focusedTaskIdRef.current;
          if (current) onToggleComplete(current);
          break;
        }
        case "x": {
          const current = focusedTaskIdRef.current;
          if (current) onToggleSelect(current);
          break;
        }
        case "d": {
          const current = focusedTaskIdRef.current;
          if (current) onOpenDatePicker(current);
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    disabled,
    moveNext,
    movePrev,
    onOpenTask,
    onCyclePriority,
    onToggleComplete,
    onToggleSelect,
    onOpenDatePicker,
  ]);

  // Derive valid focused ID — if the task was removed, treat as null
  const validFocusedTaskId =
    focusedTaskId && orderedTaskIds.includes(focusedTaskId)
      ? focusedTaskId
      : null;

  return { focusedTaskId: validFocusedTaskId, setFocusedTaskId };
}
