"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types";

interface TaskFiltersProps {
  projects: Project[];
}

export function TaskFilters({ projects }: TaskFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      router.push(`/overview?${params.toString()}`);
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.push("/overview");
  }, [router]);

  const hasFilters = searchParams.toString().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={searchParams.get("projectId") ?? "all"}
        onValueChange={(v) => setParam("projectId", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p._id} value={p._id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("priority") ?? "all"}
        onValueChange={(v) => setParam("priority", v)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("completed") ?? "false"}
        onValueChange={(v) => setParam("completed", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="false">Open</SelectItem>
          <SelectItem value="true">Completed</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("sortBy") ?? "order"}
        onValueChange={(v) => setParam("sortBy", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="order">Manual order</SelectItem>
          <SelectItem value="dueDate">Due date</SelectItem>
          <SelectItem value="priority">Priority</SelectItem>
          <SelectItem value="createdAt">Created</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="text"
        placeholder="Filter by label..."
        className="w-40"
        defaultValue={searchParams.get("labels") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const value = (e.target as HTMLInputElement).value.trim();
            setParam("labels", value || null);
          }
        }}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
