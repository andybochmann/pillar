import type { Priority } from "@/types";

export function canShareTasks(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function buildShareText(task: {
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
}): string {
  const lines: string[] = [task.title];
  if (task.description) lines.push(task.description);
  lines.push(`Priority: ${task.priority}`);
  if (task.dueDate) {
    lines.push(`Due: ${new Date(task.dueDate).toLocaleDateString()}`);
  }
  return lines.join("\n");
}

export async function shareTask(task: {
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
}): Promise<boolean> {
  if (!canShareTasks()) return false;
  try {
    await navigator.share({
      title: task.title,
      text: buildShareText(task),
    });
    return true;
  } catch (err) {
    // AbortError means user cancelled — not a real error
    if (err instanceof Error && err.name === "AbortError") return false;
    throw err;
  }
}
