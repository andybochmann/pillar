import { openDB, type IDBPDatabase } from "idb";
import type { QueuedMutation } from "@/types";

const DB_NAME = "pillar-offline";
const STORE_NAME = "mutations";
const DB_VERSION = 1;

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
  mutation: Omit<QueuedMutation, "id" | "timestamp">,
): Promise<QueuedMutation> {
  const entry: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const db = await getDb();
  await db.put(STORE_NAME, entry);
  return entry;
}

export async function getAllQueued(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const all: QueuedMutation[] = await db.getAll(STORE_NAME);
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}

export async function getQueueCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}
