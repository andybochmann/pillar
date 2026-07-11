import { EventEmitter } from "events";

export interface SyncEvent {
  entity: "task" | "project" | "category" | "label" | "member" | "note" | "filter-preset";
  action: "created" | "updated" | "deleted" | "reordered";
  userId: string;
  sessionId: string;
  entityId: string;
  projectId?: string;
  targetUserIds?: string[];
  data?: unknown;
  timestamp: number;
}

export interface NotificationEvent {
  type: "reminder" | "overdue" | "daily-summary" | "overdue-digest";
  notificationId: string;
  userId: string;
  taskId?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

declare global {
  var syncEventBus: EventEmitter | undefined;
}

export const syncEventBus: EventEmitter = (global.syncEventBus ??=
  new EventEmitter());

// Unlimited listeners (L14): one listener is added per open SSE connection and
// removed on disconnect (cleanup is correct), so a fixed cap of 200 only served
// to emit a spurious MaxListenersExceededWarning past ~100 tabs. 0 = unlimited.
syncEventBus.setMaxListeners(0);

export function emitSyncEvent(event: SyncEvent): void {
  syncEventBus.emit("sync", event);
}

export function emitNotificationEvent(event: NotificationEvent): void {
  syncEventBus.emit("notification", event);
}
