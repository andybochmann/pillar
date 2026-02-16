import type { Column } from "@/types";

/**
 * Computes the completedAt field to include when a task changes columns.
 * Moving to the last column auto-sets completedAt; moving away clears it.
 * Returns undefined if no completedAt change is needed.
 */
export function getCompletionForColumnChange(
  fromColumnId: string,
  toColumnId: string,
  columns: Column[],
): string | null | undefined {
  if (fromColumnId === toColumnId) return undefined;

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return undefined;

  const lastColumnId = sorted[sorted.length - 1].id;

  if (toColumnId === lastColumnId && fromColumnId !== lastColumnId) {
    return new Date().toISOString();
  }
  if (fromColumnId === lastColumnId && toColumnId !== lastColumnId) {
    return null;
  }
  return undefined;
}
