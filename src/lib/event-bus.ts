import { EventEmitter } from "events";

export interface SyncEvent {
  entity: "task" | "project" | "category" | "label";
  action: "created" | "updated" | "deleted" | "reordered";
  userId: string;
  sessionId: string;
  entityId: string;
  projectId?: string;
  data?: unknown;
  timestamp: number;
}

declare global {
  var syncEventBus: EventEmitter | undefined;
}

export const syncEventBus: EventEmitter =
  global.syncEventBus ??= new EventEmitter();

syncEventBus.setMaxListeners(200);

export function emitSyncEvent(event: SyncEvent): void {
  syncEventBus.emit("sync", event);
}
