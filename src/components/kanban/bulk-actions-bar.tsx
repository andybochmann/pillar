"use client";

import { useState } from "react";
import { CalendarIcon, Tag, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import type { Column, Priority, ProjectMember, Label } from "@/types";

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  columns: Column[];
  labels: Label[];
  members?: ProjectMember[];
  onClearSelection: () => void;
  onBulkMove: (columnId: string) => Promise<void>;
  onBulkPriority: (priority: Priority) => Promise<void>;
  onBulkArchive: () => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onBulkSetDueDate: (date: Date) => Promise<void>;
  onBulkAssign: (assigneeId: string | null) => Promise<void>;
  onBulkAddLabel: (labelId: string) => Promise<void>;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  columns,
  labels,
  members,
  onClearSelection,
  onBulkMove,
  onBulkPriority,
  onBulkArchive,
  onBulkDelete,
  onBulkSetDueDate,
  onBulkAssign,
  onBulkAddLabel,
}: BulkActionsBarProps) {
  const [loading, setLoading] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

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

  const hasMembers = members && members.length > 0;

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-sm"
      data-testid="bulk-actions-bar"
    >
      <span className="text-sm font-medium">
        {selectedCount} of {totalCount} tasks selected
      </span>

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

      {/* Due Date Picker */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            aria-label="Set due date"
          >
            <CalendarIcon className="mr-1 h-4 w-4" />
            Due date
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            onSelect={(date) => {
              if (date) {
                setDateOpen(false);
                handleAction(() => onBulkSetDueDate(date));
              }
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Assign Dropdown */}
      {hasMembers && (
        <Popover open={assignOpen} onOpenChange={setAssignOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              aria-label="Assign"
            >
              <UserPlus className="mr-1 h-4 w-4" />
              Assign
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-col gap-1">
              <button
                className="rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setAssignOpen(false);
                  handleAction(() => onBulkAssign(null));
                }}
              >
                Unassign
              </button>
              {members.map((m) => (
                <button
                  key={m.userId}
                  className="rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setAssignOpen(false);
                    handleAction(() => onBulkAssign(m.userId));
                  }}
                >
                  {m.userName || m.userEmail || m.userId}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Label Picker */}
      <Popover open={labelOpen} onOpenChange={setLabelOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            aria-label="Add label"
          >
            <Tag className="mr-1 h-4 w-4" />
            Label
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            {labels.map((label) => (
              <button
                key={label._id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setLabelOpen(false);
                  handleAction(() => onBulkAddLabel(label._id));
                }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </button>
            ))}
            {labels.length === 0 && (
              <span className="px-2 py-1.5 text-xs text-muted-foreground">
                No labels
              </span>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => handleAction(onBulkArchive)}
      >
        Archive
      </Button>

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
