import { getAllQueued, removeFromQueue } from "./offline-queue";
import type { SyncResult } from "@/types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function replayOne(method: string, url: string, body?: unknown): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
      if (body !== undefined) init.body = JSON.stringify(body);

      const res = await fetch(url, init);
      if (res.ok) return true;
      if (res.status >= 400 && res.status < 500) return false;
    } catch {
      // Network error — retry
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
    }
  }
  return false;
}

export async function replayQueue(): Promise<SyncResult> {
  const queued = await getAllQueued();
  const result: SyncResult = { total: queued.length, succeeded: 0, failed: 0 };

  for (const mutation of queued) {
    const ok = await replayOne(mutation.method, mutation.url, mutation.body);
    if (ok) {
      await removeFromQueue(mutation.id);
      result.succeeded++;
    } else {
      result.failed++;
    }
  }

  return result;
}
