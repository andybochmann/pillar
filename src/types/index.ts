export type Priority = "urgent" | "high" | "medium" | "low";

export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "none";

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string;
}

export interface Column {
  id: string;
  name: string;
  order: number;
}

export interface Category {
  _id: string;
  name: string;
  color: string;
  icon?: string;
  userId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  categoryId: string;
  userId: string;
  columns: Column[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  _id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  _id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  projectId: string;
  userId: string;
  columnId: string;
  priority: Priority;
  dueDate?: string;
  recurrence?: Recurrence;
  order: number;
  labels: string[];
  subtasks: Subtask[];
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedMutation {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  timestamp: number;
}

export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
}
