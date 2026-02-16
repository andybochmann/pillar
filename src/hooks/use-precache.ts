"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { Project } from "@/types";
import type { SyncEvent } from "@/lib/event-bus";

const PRECACHE_KEY = "pillar:precache-done";
const INITIAL_DELAY_MS = 5000;
const PROJECT_GAP_MS = 200;
const NEW_PROJECT_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleIdle(fn: () => void): number {
  if (typeof requestIdleCallback !== "undefined") {
    return requestIdleCallback(fn) as unknown as number;
  }
  return setTimeout(fn, 0) as unknown as number;
}

function cancelIdle(id: number): void {
  if (typeof cancelIdleCallback !== "undefined") {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

async function precacheAllProjects(router: ReturnType<typeof useRouter>): Promise<void> {
  // Fetch global endpoints in parallel — SW caches the responses
  const [projectsRes] = await Promise.all([
    fetch("/api/projects"),
    fetch("/api/labels"),
    fetch("/api/stats/task-counts"),
  ]);

  if (!projectsRes.ok) return;
  const projects: Project[] = await projectsRes.json();

  // Fetch tasks for each project sequentially with gaps
  for (const project of projects) {
    if (!navigator.onLine) break;

    await sleep(PROJECT_GAP_MS);
    await fetch(`/api/tasks?projectId=${project._id}`);
    router.prefetch(`/projects/${project._id}`);
  }
}

async function precacheNewProject(
  projectId: string,
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  await sleep(NEW_PROJECT_DELAY_MS);
  if (!navigator.onLine) return;
  await fetch(`/api/tasks?projectId=${projectId}`);
  router.prefetch(`/projects/${projectId}`);
}

export function usePrecache(): void {
  const { isOnline } = useOnlineStatus();
  const router = useRouter();
  const hasRun = useRef(false);

  // Main precache effect — runs once per session
  useEffect(() => {
    if (!isOnline) return;
    if (sessionStorage.getItem(PRECACHE_KEY)) return;
    if (hasRun.current) return;
    hasRun.current = true;

    let cancelled = false;
    let idleId: number | undefined;

    const timerId = setTimeout(() => {
      if (cancelled) return;
      idleId = scheduleIdle(() => {
        if (cancelled) return;
        precacheAllProjects(router)
          .then(() => {
            if (!cancelled) {
              sessionStorage.setItem(PRECACHE_KEY, "1");
            }
          })
          .catch(() => {
            // Silent — best effort
          });
      });
    }, INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      if (idleId !== undefined) {
        cancelIdle(idleId);
      }
    };
  }, [isOnline, router]);

  // Listen for new project creation and precache
  useEffect(() => {
    function onSync(e: Event) {
      const event = (e as CustomEvent<SyncEvent>).detail;
      if (event.entity === "project" && event.action === "created") {
        precacheNewProject(event.entityId, router).catch(() => {
          // Silent — best effort
        });
      }
    }

    window.addEventListener("pillar:sync", onSync);
    return () => window.removeEventListener("pillar:sync", onSync);
  }, [router]);
}
