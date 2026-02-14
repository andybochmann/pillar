"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Column, Priority } from "@/types";

interface BulkActionsBarProps {
  selectedCount: number;
  columns: Column[];
  onClearSelection: () => void;
  onBulkMove: (columnId: string) => Promise<void>;
  onBulkPriority: (priority: Priority) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

export function BulkActionsBar({
  selectedCount,
  columns,
  onClearSelection,
  onBulkMove,
  onBulkPriority,
  onBulkDelete,
}: BulkActionsBarProps) {
  const [loading, setLoading] = useState(false);

  if (selectedCount === 0) return null;

  async function handleAction(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm"
      data-testid="bulk-actions-bar"
    >
      <span className="text-sm font-medium">{selectedCount} selected</span>

      <Select
        onValueChange={(val) => handleAction(() => onBulkMove(val))}
        disabled={loading}
      >
        <SelectTrigger className="w-36" aria-label="Move to column">
          <SelectValue placeholder="Move to…" />
        </SelectTrigger>
        <SelectContent>
          {columns.map((col) => (
            <SelectItem key={col.id} value={col.id}>
              {col.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(val) =>
          handleAction(() => onBulkPriority(val as Priority))
        }
        disabled={loading}
      >
        <SelectTrigger className="w-36" aria-label="Set priority">
          <SelectValue placeholder="Set priority…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="destructive"
        size="sm"
        disabled={loading}
        onClick={() => handleAction(onBulkDelete)}
      >
        Delete
      </Button>

      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        Cancel
      </Button>
    </div>
  );
}
