import { getAllQueued, removeFromQueue, type StoredMutation } from "./offline-queue";
import { getSessionId } from "./session-id";
import type { SyncResult } from "@/types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface ReplayResult extends SyncResult {
  /** Count of mutations dropped because the server rejected them with a 4xx. */
  permanentFailures: number;
  /** True if a mutation was blocked by an auth redirect (session expired). */
  authRequired: boolean;
}

interface ReplayOutcome {
  status: "success" | "permanent" | "transient" | "auth";
  /** Server-assigned `_id` parsed from a successful create response, if any. */
  createdId?: string;
}

/**
 * Rewrites any references to an offline temp id (in a URL or JSON body) to the
 * real server id once it becomes known.
 */
function rewriteRefs<T>(value: T, tempId: string, realId: string): T {
  const str = JSON.stringify(value);
  if (str === undefined || !str.includes(tempId)) return value;
  return JSON.parse(str.split(tempId).join(realId)) as T;
}

async function replayOne(
  method: string,
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<ReplayOutcome> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const init: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": getSessionId(),
          "Idempotency-Key": idempotencyKey,
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);

      const res = await fetch(url, init);

      // An auth 302 → /login is followed by the browser to a 200 login page.
      // Treat that as a transient auth failure so the mutation stays queued
      // instead of being silently discarded when the session expired.
      if (res.redirected || !res.url.includes("/api/")) {
        return { status: "auth" };
      }

      if (res.ok) {
        let createdId: string | undefined;
        if (method === "POST") {
          try {
            const data = await res.clone().json();
            if (data && typeof data._id === "string") createdId = data._id;
          } catch {
            // Non-JSON success body — no id to capture
          }
        }
        return { status: "success", createdId };
      }
      if (res.status >= 400 && res.status < 500) return { status: "permanent" };
    } catch {
      // Network error — retry
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
    }
  }
  return { status: "transient" };
}

export async function replayQueue(): Promise<ReplayResult> {
  const queued: StoredMutation[] = await getAllQueued();
  const result: ReplayResult = {
    total: queued.length,
    succeeded: 0,
    failed: 0,
    permanentFailures: 0,
    authRequired: false,
  };

  // Maps an offline temp id (offline-<uuid>) to the real server id once the
  // queued POST that created it has replayed successfully.
  const idMap = new Map<string, string>();

  for (const mutation of queued) {
    let url = mutation.url;
    let body = mutation.body;
    for (const [tempId, realId] of idMap) {
      if (url.includes(tempId)) url = url.split(tempId).join(realId);
      body = rewriteRefs(body, tempId, realId);
    }

    const outcome = await replayOne(mutation.method, url, body, mutation.id);

    if (outcome.status === "success") {
      if (mutation.tempId && outcome.createdId) {
        idMap.set(mutation.tempId, outcome.createdId);
      }
      await removeFromQueue(mutation.id);
      result.succeeded++;
    } else if (outcome.status === "permanent") {
      // 4xx — not retryable; remove from queue so it doesn't replay forever
      await removeFromQueue(mutation.id);
      result.failed++;
      result.permanentFailures++;
    } else if (outcome.status === "auth") {
      // Session expired — keep queued and stop; nothing else will succeed.
      result.authRequired = true;
      result.failed++;
      break;
    } else {
      // "transient" — leave in queue for next sync attempt
      result.failed++;
    }
  }

  if (result.authRequired && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pillar:auth-required"));
  }

  return result;
}
