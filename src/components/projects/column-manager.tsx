"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Column } from "@/types";

interface ColumnManagerProps {
  columns: Column[];
  onSave: (columns: Column[]) => Promise<void>;
  hasTasksInColumn?: (columnId: string) => boolean;
}

interface SortableColumnItemProps {
  column: Column;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  hasTasksInColumn: boolean;
}

function SortableColumnItem({
  column,
  onRename,
  onDelete,
  canDelete,
  hasTasksInColumn,
}: SortableColumnItemProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) {
      onRename(column.id, trimmed);
    } else {
      setName(column.name);
    }
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card p-2",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label={`Drag to reorder ${column.name}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setName(column.name);
              setEditing(false);
            }
          }}
          className="h-7 text-sm"
          autoFocus
        />
      ) : (
        <span
          className="flex-1 cursor-pointer text-sm"
          onDoubleClick={() => setEditing(true)}
        >
          {column.name}
        </span>
      )}

      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(column.id)}
          disabled={hasTasksInColumn}
          title={
            hasTasksInColumn
              ? "Move tasks out of this column before deleting"
              : `Delete ${column.name}`
          }
          aria-label={`Delete ${column.name}`}
        >
          ×
        </Button>
      )}
    </div>
  );
}

export function ColumnManager({
  columns: initialColumns,
  onSave,
  hasTasksInColumn,
}: ColumnManagerProps) {
  const [columns, setColumns] = useState<Column[]>(
    [...initialColumns].sort((a, b) => a.order - b.order),
  );
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setColumns((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex).map((c, i) => ({
        ...c,
        order: i,
      }));
      return reordered;
    });
    setDirty(true);
  }, []);

  function handleRename(id: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    setDirty(true);
  }

  function handleDelete(id: string) {
    setColumns((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      return filtered.map((c, i) => ({ ...c, order: i }));
    });
    setDirty(true);
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const id = crypto.randomUUID();
    setColumns((prev) => [
      ...prev,
      { id, name: trimmed, order: prev.length },
    ]);
    setNewName("");
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(columns);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Columns</h3>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columns.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {columns.map((column) => (
              <SortableColumnItem
                key={column.id}
                column={column}
                onRename={handleRename}
                onDelete={handleDelete}
                canDelete={columns.length > 1}
                hasTasksInColumn={
                  hasTasksInColumn ? hasTasksInColumn(column.id) : false
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New column name..."
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newName.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
