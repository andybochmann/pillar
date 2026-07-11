import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncEventBus, type SyncEvent, type NotificationEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 30_000;
// L23: SSE auth was only checked at connect, so a stream survived logout / JWT
// expiry. Re-validate every few heartbeats and enforce a hard max lifetime so a
// stream cannot outlive the session; the client's EventSource reconnects and
// re-authenticates at connect time.
const REVALIDATE_EVERY_N_HEARTBEATS = 4; // ~every 2 minutes
const MAX_STREAM_LIFETIME_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientSessionId = searchParams.get("sessionId") ?? "";
  const userId = session.user.id;

  let cleanupRef: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(text: string): boolean {
        try {
          controller.enqueue(encoder.encode(text));
          return true;
        } catch {
          return false;
        }
      }

      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        syncEventBus.off("sync", onSync);
        syncEventBus.off("notification", onNotification);
        clearInterval(heartbeat);
        clearTimeout(maxLifetime);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
      cleanupRef = cleanup;

      // Hard cap: force reconnect (and thus a fresh connect-time auth) so a
      // stream can never outlive the session window.
      const maxLifetime = setTimeout(cleanup, MAX_STREAM_LIFETIME_MS);

      function onSync(event: SyncEvent) {
        // Skip events from the same browser tab
        if (event.sessionId === clientSessionId) return;
        // Deliver if user matches OR is in targetUserIds
        const isTarget = event.userId === userId ||
          (event.targetUserIds?.includes(userId) ?? false);
        if (!isTarget) return;
        send(`event: sync\ndata: ${JSON.stringify(event)}\n\n`);
      }

      function onNotification(event: NotificationEvent) {
        if (event.userId !== userId) return;
        send(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
      }

      send(": connected\n\n");
      syncEventBus.on("sync", onSync);
      syncEventBus.on("notification", onNotification);

      let heartbeats = 0;
      const heartbeat = setInterval(() => {
        if (!send(": heartbeat\n\n")) {
          cleanup();
          return;
        }
        heartbeats += 1;
        if (heartbeats % REVALIDATE_EVERY_N_HEARTBEATS === 0) {
          // Best-effort revalidation: close on a definitively invalid/changed
          // session. Swallow transient errors (fail open) to avoid dropping a
          // still-valid connection.
          auth()
            .then((current) => {
              if (!current?.user?.id || current.user.id !== userId) {
                cleanup();
              }
            })
            .catch(() => {
              // ignore transient auth errors
            });
        }
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanupRef?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
