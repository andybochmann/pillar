import type mongoose from "mongoose";

/**
 * Lean document types - represent Mongoose .lean() output
 * These types have ObjectId and Date objects (not yet serialized to strings)
 */

export type Priority = "urgent" | "high" | "medium" | "low";
export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "none";
export type ViewType = "board" | "list";

export interface LeanRecurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: Date;
}

export interface LeanSubtask {
  _id: mongoose.Types.ObjectId;
  title: string;
  completed: boolean;
}

export interface LeanStatusHistoryEntry {
  columnId: string;
  timestamp: Date;
}

export interface LeanTimeSession {
  _id: mongoose.Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  userId: mongoose.Types.ObjectId;
}

export interface LeanColumn {
  id: string;
  name: string;
  order: number;
}

export interface LeanTask {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  assigneeId?: mongoose.Types.ObjectId;
  columnId: string;
  priority: Priority;
  dueDate?: Date;
  recurrence: LeanRecurrence;
  order: number;
  labels: mongoose.Types.ObjectId[];
  subtasks: LeanSubtask[];
  timeSessions: LeanTimeSession[];
  statusHistory: LeanStatusHistoryEntry[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeanProject {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  categoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  columns: LeanColumn[];
  viewType: ViewType;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeanCategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  color: string;
  icon?: string;
  userId: mongoose.Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeanLabel {
  _id: mongoose.Types.ObjectId;
  name: string;
  color: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialized types - represent JSON-safe output for MCP responses
 * These types have string IDs and ISO date strings
 */

export interface SerializedRecurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string;
}

export interface SerializedSubtask {
  _id: string;
  title: string;
  completed: boolean;
}

export interface SerializedStatusHistoryEntry {
  columnId: string;
  timestamp: string;
}

export interface SerializedTimeSession {
  _id: string;
  startedAt: string;
  endedAt?: string | null;
  userId: string;
}

export interface SerializedColumn {
  id: string;
  name: string;
  order: number;
}

export interface SerializedTask {
  _id: string;
  title: string;
  description?: string;
  projectId: string;
  userId: string;
  assigneeId?: string | null;
  columnId: string;
  priority: Priority;
  dueDate?: string | null;
  recurrence: SerializedRecurrence;
  order: number;
  labels: string[];
  subtasks: SerializedSubtask[];
  statusHistory: SerializedStatusHistoryEntry[];
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedProject {
  _id: string;
  name: string;
  description?: string;
  categoryId: string;
  userId: string;
  columns: SerializedColumn[];
  viewType: ViewType;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedCategory {
  _id: string;
  name: string;
  color: string;
  icon?: string;
  userId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedLabel {
  _id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
