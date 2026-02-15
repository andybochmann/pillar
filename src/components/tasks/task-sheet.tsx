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
import { StatusHistory } from "@/components/tasks/status-history";
import { LabelPicker } from "@/components/tasks/label-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import type {
  Task,
  Subtask,
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
      <SheetContent className="overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="sr-only">
          <SheetTitle>Edit Task</SheetTitle>
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
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks ?? []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
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

  function handleToggleSubtask(id: string) {
    const updated = subtasks.map((s) =>
      s._id === id ? { ...s, completed: !s.completed } : s,
    );
    setSubtasks(updated);
    saveField({ subtasks: updated });
  }

  function handleAddSubtask() {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    const tempId = `temp-${Date.now()}`;
    const updated = [...subtasks, { _id: tempId, title: trimmed, completed: false }];
    setSubtasks(updated);
    setNewSubtaskTitle("");
    saveField({ subtasks: updated });
  }

  function handleDeleteSubtask(id: string) {
    const updated = subtasks.filter((s) => s._id !== id);
    setSubtasks(updated);
    saveField({ subtasks: updated });
  }

  function handleSubtaskKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubtask();
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

  return (
    <>
      <div className="flex flex-1 flex-col px-6 pt-8 pb-6">
        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description…"
              rows={3}
            />
          </div>

          <Separator />

          {/* Priority & Column */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
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

          {/* Due Date & Recurrence */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-due-date">Due Date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <RecurrencePicker
                value={recurrence}
                onChange={handleRecurrenceChange}
              />
            </div>
          </div>

          <Separator />

          {/* Labels */}
          <div className="space-y-1.5">
            <Label>Labels</Label>
            <LabelPicker
              labels={allLabels ?? []}
              selectedLabels={labels}
              onToggle={handleToggleLabel}
              onCreate={handleCreateLabel}
            />
          </div>
          <Separator />

          {/* Subtasks */}
          <div className="space-y-2">
            <Label>Subtasks</Label>
            {subtasks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {subtasks.filter((s) => s.completed).length} of{" "}
                {subtasks.length} completed
              </p>
            )}
            <div className="space-y-1">
              {subtasks.map((subtask) => (
                <div
                  key={subtask._id}
                  className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted"
                >
                  <Checkbox
                    checked={subtask.completed}
                    onCheckedChange={() => handleToggleSubtask(subtask._id)}
                    aria-label={`Toggle ${subtask.title}`}
                  />
                  <span
                    className={
                      subtask.completed
                        ? "flex-1 text-sm line-through text-muted-foreground"
                        : "flex-1 text-sm"
                    }
                  >
                    {subtask.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => handleDeleteSubtask(subtask._id)}
                    aria-label={`Delete ${subtask.title}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a subtask…"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={handleSubtaskKeyDown}
                aria-label="New subtask title"
                className="h-8 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim()}
                aria-label="Add subtask"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status History */}
          {task.statusHistory?.length > 0 && (
            <>
              <Separator />
              <StatusHistory
                statusHistory={task.statusHistory}
                columns={columns}
              />
            </>
          )}
        </div>

        {/* Actions pinned to bottom */}
        <div className="mt-auto space-y-2 pt-6">
          {task.completedAt ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                saveField({ completedAt: null });
              }}
            >
              Reopen
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                saveField({ completedAt: new Date().toISOString() });
              }}
            >
              Mark Complete
            </Button>
          )}
          <Button
            variant="destructive"
            className="w-full"
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
