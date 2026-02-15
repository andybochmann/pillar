import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncEventBus, type SyncEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 30_000;

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientSessionId = searchParams.get("sessionId") ?? "";
  const userId = session.user.id;

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

      function cleanup() {
        syncEventBus.off("sync", onSync);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      function onSync(event: SyncEvent) {
        if (event.userId !== userId || event.sessionId === clientSessionId) return;
        send(`event: sync\ndata: ${JSON.stringify(event)}\n\n`);
      }

      send(": connected\n\n");
      syncEventBus.on("sync", onSync);

      const heartbeat = setInterval(() => {
        if (!send(": heartbeat\n\n")) cleanup();
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", cleanup);
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
