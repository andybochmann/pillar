import { getAllQueued, removeFromQueue } from "./offline-queue";
import { getSessionId } from "./session-id";
import type { SyncResult } from "@/types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function replayOne(method: string, url: string, body?: unknown): Promise<"success" | "permanent" | "transient"> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const init: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": getSessionId(),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);

      const res = await fetch(url, init);
      if (res.ok) return "success";
      if (res.status >= 400 && res.status < 500) return "permanent";
    } catch {
      // Network error — retry
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
    }
  }
  return "transient";
}

export async function replayQueue(): Promise<SyncResult> {
  const queued = await getAllQueued();
  const result: SyncResult = { total: queued.length, succeeded: 0, failed: 0 };

  for (const mutation of queued) {
    const outcome = await replayOne(mutation.method, mutation.url, mutation.body);
    if (outcome === "success") {
      await removeFromQueue(mutation.id);
      result.succeeded++;
    } else if (outcome === "permanent") {
      // 4xx — not retryable; remove from queue so it doesn't replay forever
      await removeFromQueue(mutation.id);
      result.failed++;
    } else {
      // "transient" — leave in queue for next sync attempt
      result.failed++;
    }
  }

  return result;
}
