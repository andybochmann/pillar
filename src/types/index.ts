export type Priority = "urgent" | "high" | "medium" | "low";
export type ProjectRole = "owner" | "editor" | "viewer";
export type ViewType = "board" | "list";
export type CalendarViewType = "month" | "week" | "day";

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
  collapsed: boolean;
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
  viewType: ViewType;
  archived: boolean;
  currentUserRole?: ProjectRole;
  memberCount?: number;
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

export interface StatusHistoryEntry {
  columnId: string;
  timestamp: string;
}

export interface TimeSession {
  _id: string;
  startedAt: string;
  endedAt?: string | null;
  userId: string;
}

export interface ProjectMember {
  _id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedBy: string;
  userName?: string;
  userEmail?: string;
  userImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  projectId: string;
  userId: string;
  assigneeId?: string | null;
  assigneeName?: string;
  columnId: string;
  priority: Priority;
  dueDate?: string;
  recurrence?: Recurrence;
  order: number;
  labels: string[];
  subtasks: Subtask[];
  timeSessions: TimeSession[];
  statusHistory: StatusHistoryEntry[];
  reminderAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDraft {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  columnId: string;
  subtasks: string[];
  selected: boolean;
}

export interface SubtaskDraft {
  id: string;
  title: string;
  selected: boolean;
}

export interface QueuedMutation {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  timestamp: number;
}

export interface TaskCounts {
  byCategory: Record<string, number>;
  byProjectAndColumn: Record<string, Record<string, number>>;
}

export interface AccessToken {
  _id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
}

export type NotificationType = "reminder" | "overdue" | "daily-summary";

export interface Notification {
  _id: string;
  userId: string;
  taskId?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  scheduledFor?: string;
  sentAt?: string;
  snoozedUntil?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  _id: string;
  userId: string;
  endpoint: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  enableInAppNotifications: boolean;
  enableBrowserPush: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  enableOverdueSummary: boolean;
  enableDailySummary: boolean;
  dailySummaryTime: string;
  reminderTimings: number[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
}
