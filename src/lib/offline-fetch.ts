import { addToQueue } from "./offline-queue";

export async function offlineFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  // GET requests pass through — SW cache handles offline GETs
  if (method === "GET") {
    return fetch(input, init);
  }

  // Mutations: try the real fetch first if online
  if (navigator.onLine) {
    try {
      const response = await fetch(input, init);
      return response;
    } catch {
      // Network failed despite navigator.onLine — queue it
    }
  }

  // Offline (or network failed): queue the mutation
  const body = init?.body ? JSON.parse(init.body as string) : undefined;
  await addToQueue({
    method: method as "POST" | "PATCH" | "DELETE",
    url,
    body,
  });

  // Return a synthetic success response for optimistic UI
  const syntheticBody =
    method === "DELETE"
      ? {}
      : { ...body, _id: `offline-${crypto.randomUUID()}` };

  return new Response(JSON.stringify(syntheticBody), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
