import { toLocalDate } from "@/lib/date-utils";
import type { Task, Project } from "@/types";

/** Priority ordering used for secondary sorting (lower = more important). */
const PRIORITY_ORDER: Record<Task["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type DueBucket = "overdue" | "today" | "week" | "later" | "none";

/** Ordered list of due-date buckets, most urgent first. */
export const DUE_BUCKET_ORDER: DueBucket[] = [
  "overdue",
  "today",
  "week",
  "later",
  "none",
];

/** Human-readable labels for each due-date bucket. */
export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  none: "No date",
};

/**
 * Classify a task's due date into a bucket relative to `now` (local calendar).
 * Due dates are stored as midnight UTC and compared as calendar dates.
 */
export function getDueBucket(
  dueDate: string | null | undefined,
  now: Date = new Date(),
): DueBucket {
  if (!dueDate) return "none";
  const due = toLocalDate(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / 86_400_000,
  );
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "later";
}

/**
 * Compare two tasks: earliest due date first (undated last), then by priority.
 */
export function compareTasks(a: Task, b: Task): number {
  const ad = a.dueDate ? toLocalDate(a.dueDate).getTime() : Infinity;
  const bd = b.dueDate ? toLocalDate(b.dueDate).getTime() : Infinity;
  if (ad !== bd) return ad - bd;
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

export interface ProjectGroup {
  projectId: string;
  projectName: string;
  color?: string;
  tasks: Task[];
}

/**
 * Group tasks by project, preserving the order of `projects`, then appending
 * an "Other" group for tasks whose project is unknown. Empty groups are
 * omitted and tasks within each group are sorted via {@link compareTasks}.
 */
export function groupByProject(
  tasks: Task[],
  projects: Project[],
  colorFor: (project: Project) => string | undefined = () => undefined,
): ProjectGroup[] {
  const byProject = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = byProject.get(task.projectId);
    if (list) list.push(task);
    else byProject.set(task.projectId, [task]);
  }

  const groups: ProjectGroup[] = [];
  const seen = new Set<string>();
  for (const project of projects) {
    const projectTasks = byProject.get(project._id);
    if (!projectTasks || projectTasks.length === 0) continue;
    seen.add(project._id);
    groups.push({
      projectId: project._id,
      projectName: project.name,
      color: colorFor(project),
      tasks: [...projectTasks].sort(compareTasks),
    });
  }

  const orphans = tasks.filter((t) => !seen.has(t.projectId));
  if (orphans.length > 0) {
    groups.push({
      projectId: "__other__",
      projectName: "Other",
      tasks: [...orphans].sort(compareTasks),
    });
  }

  return groups;
}

export interface DueGroup {
  bucket: DueBucket;
  label: string;
  tasks: Task[];
}

/**
 * Group tasks into due-date buckets in {@link DUE_BUCKET_ORDER}. Empty buckets
 * are omitted and tasks within each bucket are sorted via {@link compareTasks}.
 */
export function groupByDueBucket(
  tasks: Task[],
  now: Date = new Date(),
): DueGroup[] {
  const byBucket = new Map<DueBucket, Task[]>();
  for (const task of tasks) {
    const bucket = getDueBucket(task.dueDate, now);
    const list = byBucket.get(bucket);
    if (list) list.push(task);
    else byBucket.set(bucket, [task]);
  }

  return DUE_BUCKET_ORDER.flatMap((bucket) => {
    const bucketTasks = byBucket.get(bucket);
    if (!bucketTasks || bucketTasks.length === 0) return [];
    return [
      {
        bucket,
        label: DUE_BUCKET_LABELS[bucket],
        tasks: [...bucketTasks].sort(compareTasks),
      },
    ];
  });
}
