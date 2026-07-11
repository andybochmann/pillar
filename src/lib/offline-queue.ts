import { openDB, type IDBPDatabase } from "idb";
import type { QueuedMutation } from "@/types";

const DB_NAME = "pillar-offline";
const STORE_NAME = "mutations";
const DB_VERSION = 1;

/**
 * A queued mutation as persisted in IndexedDB. Extends the shared
 * {@link QueuedMutation} type with fields only used by the offline layer:
 * - `seq`: monotonic counter for stable replay ordering when timestamps collide
 * - `tempId`: the `offline-<uuid>` id handed to the UI for an offline POST, so
 *   the replayer can rewrite later mutations once the server assigns a real id
 */
export interface StoredMutation extends QueuedMutation {
  seq?: number;
  tempId?: string;
}

// Monotonic counter to disambiguate mutations queued within the same millisecond.
let seqCounter = 0;

/**
 * Notifies listeners (e.g. useOfflineQueue) that the queue changed so counts
 * and auto-sync can react without polling.
 */
function notifyQueueChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pillar:queue-changed"));
  }
}

function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function addToQueue(
  mutation: Omit<QueuedMutation, "id" | "timestamp"> & {
    id?: string;
    tempId?: string;
  },
): Promise<StoredMutation> {
  const entry: StoredMutation = {
    ...mutation,
    id: mutation.id ?? crypto.randomUUID(),
    timestamp: Date.now(),
    seq: seqCounter++,
  };
  const db = await getDb();
  await db.put(STORE_NAME, entry);
  notifyQueueChanged();
  return entry;
}

export async function getAllQueued(): Promise<StoredMutation[]> {
  const db = await getDb();
  const all: StoredMutation[] = await db.getAll(STORE_NAME);
  // Primary sort by timestamp; tie-break by the monotonic seq so replay order
  // is deterministic even when several mutations share a millisecond.
  return all.sort(
    (a, b) => a.timestamp - b.timestamp || (a.seq ?? 0) - (b.seq ?? 0),
  );
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
  notifyQueueChanged();
}

export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
  notifyQueueChanged();
}

export async function getQueueCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}
