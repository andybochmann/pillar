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

export async function offlineFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (method === "GET") return fetch(input, init);

  // Inject session ID header for mutations
  const headers = new Headers(init?.headers);
  headers.set("X-Session-Id", getSessionId());
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
  await addToQueue({ method: method as "POST" | "PATCH" | "DELETE", url, body });
  requestBackgroundSync();

  const syntheticBody = method === "DELETE" ? {} : { ...body, _id: `offline-${crypto.randomUUID()}` };
  return new Response(JSON.stringify(syntheticBody), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
