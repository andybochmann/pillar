import { addToQueue } from "./offline-queue";
import { getSessionId } from "./session-id";

function requestBackgroundSync() {
  try {
    navigator.serviceWorker?.ready.then((reg) => {
      reg.sync?.register("pillar-offline-sync");
    });
  } catch {
    // SyncManager not supported — fall back to in-app sync on reconnect
  }
}

/**
 * Extracts the entity id (last path segment) from a mutation URL, ignoring any
 * query string. e.g. `/api/tasks/abc?foo=1` -> `abc`.
 */
function idFromUrl(url: string): string | undefined {
  const path = url.split("?")[0].replace(/\/+$/, "");
  const segment = path.split("/").pop();
  return segment || undefined;
}

export async function offlineFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (method === "GET") return fetch(input, init);

  // Stable idempotency key shared between the first attempt and any queued
  // replay, so a mutation whose response is lost isn't double-applied.
  const idempotencyKey = crypto.randomUUID();

  // Inject session ID + idempotency headers for mutations
  const headers = new Headers(init?.headers);
  headers.set("X-Session-Id", getSessionId());
  headers.set("Idempotency-Key", idempotencyKey);
  const mutationInit: RequestInit = { ...init, headers };

  // Mutations: try the real fetch first if online
  if (navigator.onLine) {
    try {
      const response = await fetch(input, mutationInit);
      return response;
    } catch {
      // Network failed despite navigator.onLine — queue it
    }
  }

  const body = init?.body ? JSON.parse(init.body as string) : undefined;

  // Only POST fabricates a brand-new offline id. PATCH echoes the real id
  // parsed from the URL so consuming hooks merge (not replace) the entity, and
  // DELETE has no meaningful body.
  const tempId = method === "POST" ? `offline-${crypto.randomUUID()}` : undefined;

  await addToQueue({
    id: idempotencyKey,
    method: method as "POST" | "PATCH" | "DELETE",
    url,
    body,
    sessionId: getSessionId(),
    tempId,
  });
  requestBackgroundSync();

  let syntheticBody: Record<string, unknown>;
  if (method === "DELETE") {
    syntheticBody = {};
  } else if (method === "PATCH") {
    syntheticBody = { ...body, _id: idFromUrl(url) };
  } else {
    syntheticBody = { ...body, _id: tempId };
  }

  return new Response(JSON.stringify(syntheticBody), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
