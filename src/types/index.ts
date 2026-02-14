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
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
