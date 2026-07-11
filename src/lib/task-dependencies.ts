/**
 * Pure helpers for the task "blocked by" dependency feature.
 *
 * The dependency graph has one directed edge per blocker: a task points to every
 * task in its `blockedBy` list ("this task is blocked by that task"). A task cannot
 * be completed while any of its blockers is still open, and a blocker relationship
 * may never form a cycle.
 *
 * These functions are intentionally free of any Mongoose / DB / React dependency so
 * they can be unit-tested in isolation and reused on both the server and the client.
 */

export interface BlockerCompletionState {
  completedAt?: string | Date | null;
  archived?: boolean;
}

/**
 * A blocker still blocks its dependent while it is neither completed nor archived.
 */
export function isBlockerOpen(task: BlockerCompletionState): boolean {
  return !task.completedAt && !task.archived;
}

/**
 * Summarises the state of a task's blockers given a lookup of loaded tasks.
 *
 * - `openCount` — number of referenced blockers that are known and still open.
 * - `hasUnknown` — true when at least one referenced blocker id is absent from the
 *   lookup (its status could not be determined because it was not loaded).
 */
export function getBlockerStatus(
  blockedBy: string[] | undefined,
  tasksById: Map<string, BlockerCompletionState>,
): { openCount: number; hasUnknown: boolean } {
  let openCount = 0;
  let hasUnknown = false;
  for (const id of blockedBy ?? []) {
    const blocker = tasksById.get(id);
    if (!blocker) {
      hasUnknown = true;
      continue;
    }
    if (isBlockerOpen(blocker)) openCount += 1;
  }
  return { openCount, hasUnknown };
}

/**
 * Detects whether a dependency graph contains a cycle. Edges point from each task
 * to the tasks in its `blockedBy` list. Uses a three-colour DFS; a back edge to a
 * node still on the recursion stack (GRAY) indicates a cycle. Self-loops count.
 */
export function hasCycle(adjacency: Map<string, string[]>): boolean {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  const visit = (node: string): boolean => {
    color.set(node, GRAY);
    for (const next of adjacency.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) return true; // back edge → cycle (also catches self-loop)
      if (c === WHITE && adjacency.has(next) && visit(next)) return true;
    }
    color.set(node, BLACK);
    return false;
  };

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE && visit(node)) return true;
  }
  return false;
}

/**
 * Returns true if setting `taskId`'s `blockedBy` to `proposedBlockerIds` would
 * introduce a cycle into the project's dependency graph.
 *
 * `tasks` is the current set of project tasks; their existing `blockedBy` is used
 * for every task except `taskId`, whose blockers are replaced by the proposed list.
 * A self-reference is treated as an immediate cycle.
 */
export function wouldCreateCycle(
  taskId: string,
  proposedBlockerIds: string[],
  tasks: { _id: string; blockedBy?: string[] }[],
): boolean {
  if (proposedBlockerIds.includes(taskId)) return true;

  const adjacency = new Map<string, string[]>();
  for (const t of tasks) {
    adjacency.set(
      t._id,
      t._id === taskId ? proposedBlockerIds : (t.blockedBy ?? []),
    );
  }
  // Ensure the target task is represented even if it isn't in `tasks`.
  if (!adjacency.has(taskId)) adjacency.set(taskId, proposedBlockerIds);

  return hasCycle(adjacency);
}
