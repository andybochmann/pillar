"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { LabelPicker } from "@/components/tasks/label-picker";
import { toast } from "sonner";
import { useBackButton } from "@/hooks/use-back-button";
import { useLabels } from "@/hooks/use-labels";
import { offlineFetch } from "@/lib/offline-fetch";
import {
  getLastUsedProject,
  setLastUsedProject,
} from "@/lib/last-used-project";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Project, Priority, ProjectMember } from "@/types";

interface QuickAddTaskDialogProps {
  projects: Project[];
}

export function QuickAddTaskDialog({ projects }: QuickAddTaskDialogProps) {
  const pathname = usePathname();
  const { labels, createLabel } = useLabels();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [expanded, setExpanded] = useState(false);
  const [reminderAt, setReminderAt] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [fetchedMembersFor, setFetchedMembersFor] = useState<string | null>(
    null,
  );

  useBackButton("quick-add-task", open, () => setOpen(false));

  // Derive the default project when the dialog opens
  const deriveDefaultProject = useCallback(() => {
    if (projects.length === 0) return "";

    // 1. Current project from URL
    const match = pathname.match(/^\/projects\/([a-f0-9]{24})$/);
    if (match) {
      const found = projects.find((p) => p._id === match[1] && !p.archived);
      if (found) return found._id;
    }

    // 2. Last used project
    const lastUsed = getLastUsedProject();
    if (lastUsed) {
      const found = projects.find((p) => p._id === lastUsed && !p.archived);
      if (found) return found._id;
    }

    // 3. First non-archived project
    const first = projects.find((p) => !p.archived);
    return first?._id ?? projects[0]._id;
  }, [pathname, projects]);

  // Listen for the global open event
  useEffect(() => {
    function handle() {
      setOpen(true);
    }
    document.addEventListener("pillar:open-quick-add-task", handle);
    return () =>
      document.removeEventListener("pillar:open-quick-add-task", handle);
  }, []);

  // Set default project when opening
  useEffect(() => {
    if (open) {
      setProjectId(deriveDefaultProject());
    }
  }, [open, deriveDefaultProject]);

  // Fetch members when expanded and project is selected
  useEffect(() => {
    if (!expanded || !projectId || fetchedMembersFor === projectId) return;

    let cancelled = false;
    async function fetchMembers() {
      try {
        const res = await fetch(`/api/projects/${projectId}/members`);
        if (res.ok && !cancelled) {
          const data: ProjectMember[] = await res.json();
          setMembers(data);
          setFetchedMembersFor(projectId);
        }
      } catch {
        // Members are optional — ignore fetch errors
      }
    }
    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [expanded, projectId, fetchedMembersFor]);

  const selectedProject = projects.find((p) => p._id === projectId);

  const firstColumn = useMemo(() => {
    if (!selectedProject?.columns.length) return null;
    return [...selectedProject.columns].sort((a, b) => a.order - b.order)[0];
  }, [selectedProject]);

  function resetForm() {
    setTitle("");
    setProjectId("");
    setDueDate("");
    setPriority("medium");
    setExpanded(false);
    setReminderAt("");
    setSelectedLabels([]);
    setAssigneeId(null);
    setDescription("");
    setMembers([]);
    setFetchedMembersFor(null);
  }

  function handleOpenChange(value: boolean) {
    if (!value) resetForm();
    setOpen(value);
  }

  function handleProjectChange(id: string) {
    setProjectId(id);
    setAssigneeId(null);
    setMembers([]);
    setFetchedMembersFor(null);
  }

  function handleLabelToggle(labelId: string) {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  }

  async function handleCreateLabel(data: { name: string; color: string }) {
    const created = await createLabel(data);
    setSelectedLabels((prev) => [...prev, created._id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId || !firstColumn) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        projectId,
        columnId: firstColumn.id,
        priority,
      };

      if (dueDate) {
        body.dueDate = new Date(dueDate + "T00:00:00Z").toISOString();
      }
      if (reminderAt) {
        // DateTimePicker returns "yyyy-MM-ddTHH:mm" in local time
        const [datePart, timePart] = reminderAt.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hours, minutes] = (timePart ?? "00:00").split(":").map(Number);
        body.reminderAt = new Date(year, month - 1, day, hours, minutes).toISOString();
      }
      if (selectedLabels.length > 0) {
        body.labels = selectedLabels;
      }
      if (assigneeId) {
        body.assigneeId = assigneeId;
      }
      if (description.trim()) {
        body.description = description.trim();
      }

      const res = await offlineFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create task");
      }

      setLastUsedProject(projectId);
      toast.success("Task created");
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create task",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const nonArchivedProjects = projects.filter((p) => !p.archived);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Quick Add Task</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new task from anywhere in the app
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-task-title">Title</Label>
            <Input
              id="quick-task-title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-task-project">Project</Label>
            <Select value={projectId} onValueChange={handleProjectChange}>
              <SelectTrigger id="quick-task-project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {nonArchivedProjects.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due date</Label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="No due date"
                clearable
              />
            </div>

            <div className="space-y-2">
              <Label>Reminder</Label>
              <DateTimePicker
                value={reminderAt}
                onChange={setReminderAt}
                placeholder="No reminder"
                clearable
              />
            </div>
          </div>

          {/* More options */}
          <div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {expanded ? "Less options" : "More options"}
            </button>

            {expanded && (
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-task-priority">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as Priority)}
                  >
                    <SelectTrigger id="quick-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Labels</Label>
                  <LabelPicker
                    labels={labels}
                    selectedLabels={selectedLabels}
                    onToggle={handleLabelToggle}
                    onCreate={handleCreateLabel}
                  />
                </div>

                {members.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="quick-task-assignee">Assignee</Label>
                    <Select
                      value={assigneeId ?? "unassigned"}
                      onValueChange={(v) =>
                        setAssigneeId(v === "unassigned" ? null : v)
                      }
                    >
                      <SelectTrigger id="quick-task-assignee">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.userName || m.userEmail || m.userId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="quick-task-description">Description</Label>
                  <Textarea
                    id="quick-task-description"
                    placeholder="Optional description…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !projectId || !firstColumn || submitting}
            >
              {submitting ? "Creating…" : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
