"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { GenerateSubtasksDialog } from "@/components/tasks/generate-subtasks-dialog";
import { toast } from "sonner";
import { useBackButton } from "@/hooks/use-back-button";
import { TaskTitleDescriptionSection } from "@/components/tasks/sections/task-title-description-section";
import { TaskPriorityColumnSection } from "@/components/tasks/sections/task-priority-column-section";
import { TaskAssigneeSection } from "@/components/tasks/sections/task-assignee-section";
import { TaskLabelsSection } from "@/components/tasks/sections/task-labels-section";
import { TaskDueRecurrenceSection } from "@/components/tasks/sections/task-due-recurrence-section";
import { TaskReminderSection } from "@/components/tasks/sections/task-reminder-section";
import { TaskSubtasksSection } from "@/components/tasks/sections/task-subtasks-section";
import { TaskTimeTrackingSection } from "@/components/tasks/sections/task-time-tracking-section";
import { TaskStatusHistorySection } from "@/components/tasks/sections/task-status-history-section";
import { TaskActionsSection } from "@/components/tasks/sections/task-actions-section";
import type {
  Task,
  Subtask,
  Column,
  Priority,
  Recurrence,
  Label as LabelType,
  ProjectMember,
} from "@/types";

interface TaskSheetProps {
  task: Task | null;
  columns: Column[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: Partial<Task>) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate?: (task: Task) => void;
  allLabels?: LabelType[];
  onCreateLabel?: (data: { name: string; color: string }) => Promise<void>;
  members?: ProjectMember[];
  currentUserId?: string;
  onStartTracking?: (taskId: string) => void;
  onStopTracking?: (taskId: string) => void;
  onDeleteSession?: (taskId: string, sessionId: string) => void;
}

export function TaskSheet({
  task,
  columns,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onDuplicate,
  allLabels,
  onCreateLabel,
  members,
  currentUserId,
  onStartTracking,
  onStopTracking,
  onDeleteSession,
}: TaskSheetProps) {
  useBackButton("task-sheet", open, () => onOpenChange(false));

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="sr-only">
          <SheetTitle>Edit Task</SheetTitle>
          <SheetDescription>Edit task details</SheetDescription>
        </SheetHeader>
        <TaskSheetForm
          key={task._id}
          task={task}
          columns={columns}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onClose={() => onOpenChange(false)}
          allLabels={allLabels}
          onCreateLabel={onCreateLabel}
          members={members}
          currentUserId={currentUserId}
          onStartTracking={onStartTracking}
          onStopTracking={onStopTracking}
          onDeleteSession={onDeleteSession}
        />
      </SheetContent>
    </Sheet>
  );
}

interface TaskSheetFormProps {
  task: Task;
  columns: Column[];
  onUpdate: (id: string, data: Partial<Task>) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate?: (task: Task) => void;
  onClose: () => void;
  allLabels?: LabelType[];
  onCreateLabel?: (data: { name: string; color: string }) => Promise<void>;
  members?: ProjectMember[];
  currentUserId?: string;
  onStartTracking?: (taskId: string) => void;
  onStopTracking?: (taskId: string) => void;
  onDeleteSession?: (taskId: string, sessionId: string) => void;
}

function TaskSheetForm({
  task,
  columns,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
  allLabels,
  onCreateLabel,
  members,
  currentUserId,
  onStartTracking,
  onStopTracking,
  onDeleteSession,
}: TaskSheetFormProps) {
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [columnId, setColumnId] = useState(task.columnId);
  const [dueDate, setDueDate] = useState(
    task.dueDate ? task.dueDate.slice(0, 10) : "",
  );
  const [assigneeId, setAssigneeId] = useState<string | null>(
    task.assigneeId ?? null,
  );
  const [labels, setLabels] = useState<string[]>(task.labels);
  const [reminderAt, setReminderAt] = useState(
    task.reminderAt ? task.reminderAt.slice(0, 16) : "",
  );
  const [recurrence, setRecurrence] = useState<Recurrence>({
    frequency: task.recurrence?.frequency ?? "none",
    interval: task.recurrence?.interval ?? 1,
    endDate: task.recurrence?.endDate,
  });
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks ?? []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAIStatus() {
      try {
        const res = await fetch("/api/ai/status");
        const data: { enabled: boolean } = await res.json();
        if (!cancelled) setAiEnabled(data.enabled);
      } catch {
        // Silently fail - AI will remain disabled
      }
    }

    checkAIStatus();
    return () => {
      cancelled = true;
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

  async function handleTitleDescriptionUpdate(data: {
    title?: string;
    description?: string;
  }) {
    await onUpdate(task._id, data);
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

  function handleReminderChange(value: string) {
    setReminderAt(value);
    saveField({
      reminderAt: value ? new Date(value).toISOString() : null,
    });
  }

  function handleRecurrenceChange(value: Recurrence) {
    setRecurrence(value);
    saveField({ recurrence: value });
  }

  function handleAssigneeChange(value: string | null) {
    setAssigneeId(value);
    saveField({ assigneeId: value });
  }

  function handleToggleLabel(labelId: string) {
    const newLabels = labels.includes(labelId)
      ? labels.filter((l) => l !== labelId)
      : [...labels, labelId];
    setLabels(newLabels);
    saveField({ labels: newLabels });
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
    const updated = [
      ...subtasks,
      { _id: `temp-${Date.now()}`, title: trimmed, completed: false },
    ];
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

  function handleSubtasksAdded(titles: string[]) {
    const MAX_SUBTASKS = 50;
    const newSubtasks: Subtask[] = titles.map((title, i) => ({
      _id: `temp-${Date.now()}-${i}`,
      title,
      completed: false,
    }));

    const updated = [...subtasks, ...newSubtasks].slice(0, MAX_SUBTASKS);
    setSubtasks(updated);
    onUpdate(task._id, { subtasks: updated });
    toast.success(`Added ${newSubtasks.length} subtasks`);
  }

  async function handleTaskUpdate(data: { completedAt: string | null }) {
    await onUpdate(task._id, data);
  }

  async function handleTaskDelete(taskId: string) {
    await onDelete(taskId);
  }

  return (
    <>
      <div className="flex flex-1 flex-col px-6 pt-8 pb-6">
        <div className="space-y-5">
          <TaskTitleDescriptionSection
            taskId={task._id}
            initialTitle={task.title}
            initialDescription={task.description ?? ""}
            onUpdate={handleTitleDescriptionUpdate}
          />

          <Separator />

          <TaskPriorityColumnSection
            priority={priority}
            columnId={columnId}
            columns={columns}
            onPriorityChange={handlePriorityChange}
            onColumnChange={handleColumnChange}
          />

          <TaskAssigneeSection
            assigneeId={assigneeId}
            members={members}
            onAssigneeChange={handleAssigneeChange}
          />

          <TaskDueRecurrenceSection
            dueDate={dueDate}
            recurrence={recurrence}
            onDueDateChange={handleDueDateChange}
            onRecurrenceChange={handleRecurrenceChange}
          />

          <TaskReminderSection
            reminderAt={reminderAt}
            onReminderChange={handleReminderChange}
          />

          <Separator />

          <TaskLabelsSection
            allLabels={allLabels}
            selectedLabels={labels}
            onToggleLabel={handleToggleLabel}
            onCreateLabel={onCreateLabel}
          />

          <Separator />

          <TaskSubtasksSection
            subtasks={subtasks}
            onToggleSubtask={handleToggleSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            newSubtaskTitle={newSubtaskTitle}
            onNewSubtaskTitleChange={setNewSubtaskTitle}
            onAddSubtask={handleAddSubtask}
            onSubtaskKeyDown={handleSubtaskKeyDown}
            aiEnabled={aiEnabled}
            onGenerateClick={() => setGenerateDialogOpen(true)}
            maxSubtasks={50}
          />

          <TaskTimeTrackingSection
            taskId={task._id}
            timeSessions={task.timeSessions ?? []}
            currentUserId={currentUserId}
            onStartTracking={onStartTracking}
            onStopTracking={onStopTracking}
            onDeleteSession={onDeleteSession}
          />

          {task.statusHistory && task.statusHistory.length > 0 && (
            <>
              <Separator />
              <TaskStatusHistorySection
                statusHistory={task.statusHistory}
                columns={columns}
              />
            </>
          )}
        </div>

        <TaskActionsSection
          taskId={task._id}
          taskTitle={task.title}
          completedAt={task.completedAt ?? null}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          onDuplicate={onDuplicate ? () => onDuplicate(task) : undefined}
          onClose={onClose}
        />
      </div>
      <GenerateSubtasksDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        taskTitle={task.title}
        taskDescription={task.description}
        taskPriority={task.priority}
        existingSubtasks={subtasks.map((s) => s.title)}
        maxSubtasks={50}
        onSubtasksAdded={handleSubtasksAdded}
      />
    </>
  );
}
