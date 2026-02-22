"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard, BoardFilterBar, EMPTY_FILTERS, type BoardFilters } from "@/components/kanban";
import { ListView } from "@/components/list/list-view";
import { ProjectSettings } from "@/components/projects/project-settings";
import { GenerateTasksDialog } from "@/components/tasks/generate-tasks-dialog";
import { useLabels } from "@/hooks/use-labels";
import { toast } from "sonner";
import { Users, Sparkles, StickyNote, Archive } from "lucide-react";
import { ArchivedTasksSheet } from "@/components/kanban/archived-tasks-sheet";
import type { Project, Task, ProjectMember as ProjectMemberType, Column } from "@/types";

function getListTaskCounts(columns: Column[], taskCounts: Record<string, number>): string {
  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const lastColId = sorted[sorted.length - 1]?.id;
  const completed = taskCounts[lastColId] ?? 0;
  const active = Object.entries(taskCounts)
    .filter(([id]) => id !== lastColId)
    .reduce((sum, [, count]) => sum + count, 0);
  return `${active} active · ${completed} completed`;
}

interface ProjectViewProps {
  project: Project;
  initialTasks: Task[];
  categoryName?: string;
  members?: ProjectMemberType[];
  currentUserId?: string;
}

export function ProjectView({
  project,
  initialTasks,
  categoryName,
  members,
  currentUserId,
}: ProjectViewProps) {
  const router = useRouter();
  const [currentProject, setCurrentProject] = useState(project);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const readOnly = currentProject.currentUserRole === "viewer";
  const [liveTasks, setLiveTasks] = useState<Task[]>(initialTasks);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const { labels: allLabels, createLabel } = useLabels();

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

  const liveTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of liveTasks) {
      counts[t.columnId] = (counts[t.columnId] ?? 0) + 1;
    }
    return counts;
  }, [liveTasks]);

  const handleUpdate = useCallback(
    async (data: Partial<Project>) => {
      const res = await fetch(`/api/projects/${currentProject._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update project");
      }
      const updated: Project = await res.json();
      setCurrentProject(updated);

      // If archived, navigate away
      if (data.archived) {
        setSettingsOpen(false);
        router.push("/home");
        router.refresh();
      }
    },
    [currentProject._id, router],
  );

  const handleDelete = useCallback(async () => {
    const res = await fetch(`/api/projects/${currentProject._id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to delete project");
    }
    toast.success("Project deleted");
    router.push("/home");
    router.refresh();
  }, [currentProject._id, router]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {categoryName && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {categoryName}
            </p>
          )}
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {currentProject.name}
            </h1>
            {currentProject.memberCount && currentProject.memberCount > 1 && (
              <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                <Users className="h-3 w-3" />
                {currentProject.memberCount}
              </Badge>
            )}
          </div>
          {currentProject.description && (
            <p className="text-muted-foreground">
              {currentProject.description}
            </p>
          )}
          {Object.keys(liveTaskCounts).length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {currentProject.viewType === "list"
                ? getListTaskCounts(currentProject.columns, liveTaskCounts)
                : currentProject.columns
                    .filter((col) => liveTaskCounts[col.id])
                    .map((col) => `${liveTaskCounts[col.id]} ${col.name.toLowerCase()}`)
                    .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentProject.viewType !== "list" && (
            <BoardFilterBar
              filters={filters}
              onChange={setFilters}
              allLabels={allLabels}
            />
          )}
          <Button variant="outline" size="sm" asChild className="gap-1">
            <Link href={`/projects/${currentProject._id}/notes`}>
              <StickyNote className="h-4 w-4" />
              Notes
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchivedOpen(true)}
            className="gap-1"
          >
            <Archive className="h-4 w-4" />
            Archived
          </Button>
          {aiEnabled && !readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGenerateDialogOpen(true)}
              className="gap-1"
            >
              <Sparkles className="h-4 w-4" />
              Generate Tasks
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </Button>
          )}
        </div>
      </div>

      {currentProject.viewType === "list" ? (
        <ListView
          projectId={currentProject._id}
          columns={currentProject.columns}
          initialTasks={initialTasks}
          members={members}
          readOnly={readOnly}
          onTasksChange={setLiveTasks}
        />
      ) : (
        <KanbanBoard
          projectId={currentProject._id}
          columns={currentProject.columns}
          initialTasks={initialTasks}
          members={members}
          readOnly={readOnly}
          currentUserId={currentUserId}
          onTasksChange={setLiveTasks}
          filters={filters}
          allLabels={allLabels}
          onCreateLabel={async (data) => { await createLabel(data); }}
        />
      )}

      <ArchivedTasksSheet
        projectId={currentProject._id}
        open={archivedOpen}
        onOpenChange={setArchivedOpen}
      />

      <ProjectSettings
        project={currentProject}
        tasks={initialTasks}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {aiEnabled && !readOnly && (
        <GenerateTasksDialog
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          projectId={currentProject._id}
          onTasksAdded={() => setGenerateDialogOpen(false)}
        />
      )}
    </div>
  );
}
