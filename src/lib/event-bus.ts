import { EventEmitter } from "events";

export interface SyncEvent {
  entity: "task" | "project" | "category" | "label" | "member";
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
  type: "due-soon" | "overdue" | "reminder" | "daily-summary";
  notificationId: string;
  userId: string;
  taskId: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
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

export function emitNotificationEvent(event: NotificationEvent): void {
  syncEventBus.emit("notification", event);
}
