"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { offlineFetch } from "@/lib/offline-fetch";
import { toast } from "sonner";
import type { Project } from "@/types";

interface ShareTaskFormProps {
  sharedTitle?: string;
  sharedText?: string;
  sharedUrl?: string;
}

export function ShareTaskForm({
  sharedTitle,
  sharedText,
  sharedUrl,
}: ShareTaskFormProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derive title and description from shared data
  useEffect(() => {
    let derivedTitle = "";
    let derivedDescription = "";

    if (sharedTitle) {
      derivedTitle = sharedTitle;
      const parts: string[] = [];
      if (sharedText) parts.push(sharedText);
      if (sharedUrl) parts.push(sharedUrl);
      derivedDescription = parts.join("\n");
    } else if (sharedText) {
      const lines = sharedText.split("\n");
      derivedTitle = lines[0];
      const rest = lines.slice(1).join("\n").trim();
      const parts: string[] = [];
      if (rest) parts.push(rest);
      if (sharedUrl) parts.push(sharedUrl);
      derivedDescription = parts.join("\n");
    } else if (sharedUrl) {
      derivedTitle = sharedUrl;
    }

    setTitle(derivedTitle);
    setDescription(derivedDescription);
  }, [sharedTitle, sharedText, sharedUrl]);

  // Fetch projects
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data: Project[] = await res.json();
        if (!cancelled) {
          const active = data.filter((p) => !p.archived);
          setProjects(active);
          if (active.length > 0) setSelectedProjectId(active[0]._id);
        }
      } catch {
        // Silently fail - user can retry
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !selectedProjectId) return;

    const project = projects.find((p) => p._id === selectedProjectId);
    if (!project) return;

    const sortedColumns = [...project.columns].sort(
      (a, b) => a.order - b.order
    );
    const columnId = sortedColumns[0]?.id ?? "todo";

    setSubmitting(true);
    try {
      const res = await offlineFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: selectedProjectId,
          columnId,
          priority: "medium",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create task");
      }

      toast.success("Task created from shared content");
      router.push(`/projects/${selectedProjectId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create task"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="share-project"
          className="mb-1 block text-sm font-medium"
        >
          Project
        </label>
        <select
          id="share-project"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm"
        >
          <option value="" disabled>
            Select a project
          </option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="share-title"
          className="mb-1 block text-sm font-medium"
        >
          Title
        </label>
        <Input
          id="share-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          required
        />
      </div>

      <div>
        <label
          htmlFor="share-description"
          className="mb-1 block text-sm font-medium"
        >
          Description
        </label>
        <Textarea
          id="share-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task description"
          rows={4}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={submitting || !title.trim() || !selectedProjectId}
        >
          {submitting ? "Creating..." : "Create Task"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
