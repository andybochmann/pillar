import mongoose from "mongoose";
import { User, type IUser } from "@/models/user";
import { Category, type ICategory } from "@/models/category";
import { Project, type IProject } from "@/models/project";
import { Task, type ITask } from "@/models/task";
import { Label, type ILabel } from "@/models/label";
import {
  ProjectMember,
  type IProjectMember,
  type ProjectRole,
} from "@/models/project-member";
import {
  AccessToken,
  type IAccessToken,
} from "@/models/access-token";
import {
  PushSubscription,
  type IPushSubscription,
} from "@/models/push-subscription";
import { Account, type IAccount } from "@/models/account";
import { Note, type INote, type NoteParentType } from "@/models/note";
import {
  FilterPreset,
  type IFilterPreset,
  type FilterPresetContext,
} from "@/models/filter-preset";
import { hash } from "bcryptjs";
import { generateToken, hashToken } from "@/lib/mcp-auth";

interface CreateUserInput {
  name?: string;
  email?: string;
  password?: string;
  image?: string;
}

export async function createTestUser(
  overrides: CreateUserInput = {},
): Promise<IUser> {
  const passwordHash = await hash(overrides.password ?? "TestPass123!", 10);
  return User.create({
    name: overrides.name ?? "Test User",
    email:
      overrides.email ?? `test-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash,
    image: overrides.image,
  });
}

interface CreateCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  userId: mongoose.Types.ObjectId;
  order?: number;
}

export async function createTestCategory(
  overrides: CreateCategoryInput,
): Promise<ICategory> {
  return Category.create({
    name: overrides.name ?? "Test Category",
    color: overrides.color ?? "#6366f1",
    icon: overrides.icon,
    userId: overrides.userId,
    order: overrides.order ?? 0,
  });
}

interface CreateProjectInput {
  name?: string;
  description?: string;
  categoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  columns?: { id: string; name: string; order: number }[];
  viewType?: "board" | "list";
  archived?: boolean;
}

export async function createTestProject(
  overrides: CreateProjectInput,
): Promise<IProject> {
  return Project.create({
    name: overrides.name ?? "Test Project",
    description: overrides.description,
    categoryId: overrides.categoryId,
    userId: overrides.userId,
    columns: overrides.columns,
    viewType: overrides.viewType,
    archived: overrides.archived ?? false,
  });
}

interface CreateTaskInput {
  title?: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  assigneeId?: mongoose.Types.ObjectId;
  columnId?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  dueDate?: Date;
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly" | "yearly" | "none";
    interval?: number;
    endDate?: Date;
  };
  order?: number;
  labels?: (mongoose.Types.ObjectId | string)[];
  subtasks?: { title: string; completed?: boolean }[];
  timeSessions?: {
    startedAt: Date;
    endedAt?: Date;
    userId: mongoose.Types.ObjectId;
  }[];
  statusHistory?: { columnId: string; timestamp: Date }[];
  completedAt?: Date;
  reminderAt?: Date;
  archived?: boolean;
  archivedAt?: Date;
}

export async function createTestTask(
  overrides: CreateTaskInput,
): Promise<ITask> {
  return Task.create({
    title: overrides.title ?? "Test Task",
    description: overrides.description,
    projectId: overrides.projectId,
    userId: overrides.userId,
    assigneeId: overrides.assigneeId,
    columnId: overrides.columnId ?? "todo",
    priority: overrides.priority ?? "medium",
    dueDate: overrides.dueDate,
    reminderAt: overrides.reminderAt,
    recurrence: overrides.recurrence,
    order: overrides.order ?? 0,
    labels: overrides.labels ?? [],
    subtasks: overrides.subtasks ?? [],
    timeSessions: overrides.timeSessions ?? [],
    statusHistory: overrides.statusHistory ?? [],
    completedAt: overrides.completedAt,
    archived: overrides.archived ?? false,
    archivedAt: overrides.archivedAt,
  });
}

interface CreateLabelInput {
  name?: string;
  color?: string;
  userId: mongoose.Types.ObjectId;
}

export async function createTestLabel(
  overrides: CreateLabelInput,
): Promise<ILabel> {
  return Label.create({
    name: overrides.name ?? "Test Label",
    color: overrides.color ?? "#ef4444",
    userId: overrides.userId,
  });
}

interface CreateProjectMemberInput {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role?: ProjectRole;
  invitedBy: mongoose.Types.ObjectId;
}

export async function createTestProjectMember(
  overrides: CreateProjectMemberInput,
): Promise<IProjectMember> {
  return ProjectMember.create({
    projectId: overrides.projectId,
    userId: overrides.userId,
    role: overrides.role ?? "editor",
    invitedBy: overrides.invitedBy,
  });
}

interface CreateAccessTokenInput {
  userId: mongoose.Types.ObjectId;
  name?: string;
  expiresAt?: Date | null;
}

export async function createTestAccessToken(
  overrides: CreateAccessTokenInput,
): Promise<{ token: IAccessToken; rawToken: string }> {
  const raw = generateToken();
  const token = await AccessToken.create({
    userId: overrides.userId,
    name: overrides.name ?? "Test Token",
    tokenHash: hashToken(raw),
    tokenPrefix: raw.slice(0, 8),
    expiresAt: overrides.expiresAt ?? null,
  });
  return { token, rawToken: raw };
}

interface CreateAccountInput {
  userId: mongoose.Types.ObjectId;
  provider?: string;
  providerAccountId?: string;
}

export async function createTestAccount(
  overrides: CreateAccountInput,
): Promise<IAccount> {
  return Account.create({
    userId: overrides.userId,
    provider: overrides.provider ?? "credentials",
    providerAccountId:
      overrides.providerAccountId ?? overrides.userId.toString(),
  });
}

interface CreatePushSubscriptionInput {
  userId: mongoose.Types.ObjectId;
  endpoint?: string;
  keys?: { p256dh: string; auth: string };
  userAgent?: string;
}

export async function createTestPushSubscription(
  overrides: CreatePushSubscriptionInput,
): Promise<IPushSubscription> {
  return PushSubscription.create({
    userId: overrides.userId,
    endpoint:
      overrides.endpoint ??
      `https://fcm.googleapis.com/fcm/send/${new mongoose.Types.ObjectId()}`,
    keys: overrides.keys ?? {
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfWJ4=",
      auth: "tBHItJI5svbpC7htQ-VNRQ==",
    },
    userAgent: overrides.userAgent,
  });
}

interface CreateNoteInput {
  title?: string;
  content?: string;
  parentType: NoteParentType;
  categoryId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  pinned?: boolean;
  order?: number;
}

export async function createTestNote(
  overrides: CreateNoteInput,
): Promise<INote> {
  return Note.create({
    title: overrides.title ?? "Test Note",
    content: overrides.content ?? "Test content",
    parentType: overrides.parentType,
    categoryId: overrides.categoryId,
    projectId: overrides.projectId,
    taskId: overrides.taskId,
    userId: overrides.userId,
    pinned: overrides.pinned ?? false,
    order: overrides.order ?? 0,
  });
}

interface CreateFilterPresetInput {
  name?: string;
  userId: mongoose.Types.ObjectId;
  context?: FilterPresetContext;
  filters?: Record<string, string | string[]>;
  order?: number;
}

export async function createTestFilterPreset(
  overrides: CreateFilterPresetInput,
): Promise<IFilterPreset> {
  return FilterPreset.create({
    name: overrides.name ?? "Test Preset",
    userId: overrides.userId,
    context: overrides.context ?? "overview",
    filters: overrides.filters ?? {},
    order: overrides.order ?? 0,
  });
}
