"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RecurrencePicker } from "@/components/tasks/recurrence-picker";
import { LabelPicker } from "@/components/tasks/label-picker";
import { toast } from "sonner";
import type {
  Task,
  Column,
  Priority,
  Recurrence,
  Label as LabelType,
} from "@/types";

interface TaskSheetProps {
  task: Task | null;
  columns: Column[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Partial<Task>) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  allLabels?: LabelType[];
  onCreateLabel?: (data: { name: string; color: string }) => Promise<void>;
}

export function TaskSheet({
  task,
  columns,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  allLabels,
  onCreateLabel,
}: TaskSheetProps) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="sr-only">Edit Task</SheetTitle>
        </SheetHeader>
        <TaskSheetForm
          key={task._id}
          task={task}
          columns={columns}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => onOpenChange(false)}
          allLabels={allLabels}
          onCreateLabel={onCreateLabel}
        />
      </SheetContent>
    </Sheet>
  );
}

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];

interface TaskSheetFormProps {
  task: Task;
  columns: Column[];
  onUpdate: (id: string, data: Partial<Task>) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  allLabels?: LabelType[];
  onCreateLabel?: (data: { name: string; color: string }) => Promise<void>;
}

function TaskSheetForm({
  task,
  columns,
  onUpdate,
  onDelete,
  onClose,
  allLabels,
  onCreateLabel,
}: TaskSheetFormProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [columnId, setColumnId] = useState(task.columnId);
  const [dueDate, setDueDate] = useState(
    task.dueDate ? task.dueDate.slice(0, 10) : "",
  );
  const [labels, setLabels] = useState<string[]>(task.labels);
  const [recurrence, setRecurrence] = useState<Recurrence>({
    frequency: task.recurrence?.frequency ?? "none",
    interval: task.recurrence?.interval ?? 1,
    endDate: task.recurrence?.endDate,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const saveField = useCallback(
    (data: Partial<Task>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await onUpdate(task._id, data);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to save");
        }
      }, 500);
    },
    [task._id, onUpdate],
  );

  function handleTitleBlur() {
    if (title.trim() === task.title) return;
    if (!title.trim()) {
      setTitle(task.title);
      return;
    }
    saveField({ title: title.trim() });
  }

  function handleDescriptionBlur() {
    if (description === (task.description ?? "")) return;
    saveField({ description });
  }

  function handlePriorityChange(value: Priority) {
    setPriority(value);
    saveField({ priority: value });
  }

  function handleColumnChange(value: string) {
    setColumnId(value);
    saveField({ columnId: value });
  }

  function handleDueDateChange(value: string) {
    setDueDate(value);
    saveField({
      dueDate: value ? new Date(value + "T00:00:00Z").toISOString() : undefined,
    });
  }

  function handleRecurrenceChange(value: Recurrence) {
    setRecurrence(value);
    saveField({ recurrence: value });
  }

  function handleToggleLabel(labelName: string) {
    const newLabels = labels.includes(labelName)
      ? labels.filter((l) => l !== labelName)
      : [...labels, labelName];
    setLabels(newLabels);
    saveField({ labels: newLabels });
  }

  async function handleCreateLabel(data: { name: string; color: string }) {
    if (onCreateLabel) {
      await onCreateLabel(data);
    }
  }

  async function handleDelete() {
    try {
      await onDelete(task._id);
      toast.success("Task deleted");
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  async function handleMarkComplete() {
    try {
      await onUpdate(task._id, {
        completedAt: task.completedAt ? null : new Date().toISOString(),
      });
      toast.success(task.completedAt ? "Task reopened" : "Task completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  return (
    <>
      <div className="space-y-6 py-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-lg font-semibold"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Add a description…"
            rows={4}
          />
        </div>

        <Separator />

        {/* Priority & Column */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="task-priority">Priority</Label>
            <Select value={priority} onValueChange={handlePriorityChange}>
              <SelectTrigger id="task-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-column">Column</Label>
            <Select value={columnId} onValueChange={handleColumnChange}>
              <SelectTrigger id="task-column">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <Label htmlFor="task-due-date">Due Date</Label>
          <Input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => handleDueDateChange(e.target.value)}
          />
        </div>

        {/* Recurrence */}
        <div className="space-y-2">
          <Label>Recurrence</Label>
          <RecurrencePicker
            value={recurrence}
            onChange={handleRecurrenceChange}
          />
        </div>

        <Separator />

        {/* Labels */}
        <div className="space-y-2">
          <Label>Labels</Label>
          <LabelPicker
            labels={allLabels ?? []}
            selectedLabels={labels}
            onToggle={handleToggleLabel}
            onCreate={handleCreateLabel}
          />
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleMarkComplete}
          >
            {task.completedAt ? "Reopen" : "Mark Complete"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete task?"
        description={`"${task.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
