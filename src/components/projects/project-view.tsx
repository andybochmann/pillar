"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban";
import { ProjectSettings } from "@/components/projects/project-settings";
import { toast } from "sonner";
import type { Project, Task } from "@/types";

interface ProjectViewProps {
  project: Project;
  initialTasks: Task[];
}

export function ProjectView({ project, initialTasks }: ProjectViewProps) {
  const router = useRouter();
  const [currentProject, setCurrentProject] = useState(project);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        router.push("/");
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
    router.push("/");
    router.refresh();
  }, [currentProject._id, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {currentProject.name}
          </h1>
          {currentProject.description && (
            <p className="text-muted-foreground">
              {currentProject.description}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </Button>
      </div>

      <KanbanBoard
        projectId={currentProject._id}
        columns={currentProject.columns}
        initialTasks={initialTasks}
      />

      <ProjectSettings
        project={currentProject}
        tasks={initialTasks}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
