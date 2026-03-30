"use client";

import { useProjects } from "@/hooks/use-projects";
import { QuickAddTaskDialog } from "@/components/tasks/quick-add-task-dialog";

export function QuickAddTaskProvider() {
  const { projects } = useProjects();
  return <QuickAddTaskDialog projects={projects} />;
}
