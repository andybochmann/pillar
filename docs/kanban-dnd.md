# Kanban Drag & Drop

## Overview

Pillar's Kanban board uses `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop task management. Tasks can be reordered within a column or moved across columns. All operations use optimistic updates with API fallback on failure.

## Key Files

| Purpose | File |
|---|---|
| Board (DndContext) | `src/components/kanban/kanban-board.tsx` |
| Column (SortableContext) | `src/components/kanban/kanban-column.tsx` |
| Task card (useSortable) | `src/components/kanban/task-card.tsx` |
| Reorder API | `src/app/api/tasks/reorder/route.ts` |
| Filter bar | `src/components/kanban/board-filter-bar.tsx` |
| Bulk actions bar | `src/components/kanban/bulk-actions-bar.tsx` |

## Architecture

### Board (`kanban-board.tsx`)

The top-level `DndContext` with a stable `id="kanban-dnd"` to prevent React hydration mismatches. Manages two key drag event handlers:

- **`handleDragOver`** — Fires when a card is dragged over a different column. Updates the task's `columnId` in local state immediately (optimistic cross-column move).
- **`handleDragEnd`** — Fires when the drag operation completes. Persists the change:
  - **Cross-column move**: calls `updateTask()` to save the new column assignment.
  - **Within-column reorder**: uses `arrayMove` from `@dnd-kit/sortable` to recompute order, then calls the reorder API.

### Column (`kanban-column.tsx`)

Each column wraps its task cards in a `SortableContext`, providing the sortable item IDs for that column. This scopes the sortable behavior to cards within the same column.

### Task Card (`task-card.tsx`)

Each card uses the `useSortable` hook from `@dnd-kit/sortable`, which provides the drag handle, transform styles, and transition animations.

### Reorder API (`/api/tasks/reorder`)

Accepts a bulk order update — an array of `{ taskId, order }` pairs. Validates that all referenced tasks belong to the same project (preventing cross-project reorder exploits). Updates the `order` field on each task in a single operation.

## Optimistic Updates

All drag operations update local state immediately for a responsive feel. If the subsequent API call fails, the board refetches the full task list to revert to the server's state.

## Filtering

The filter bar (`board-filter-bar.tsx`) allows users to filter visible tasks by:

- **Priority** — urgent, high, medium, low
- **Labels** — any labels assigned to tasks
- **Due date range** — tasks within a specific date window

Filters are applied client-side to the task list before rendering columns.

## Bulk Actions

The bulk actions bar (`bulk-actions-bar.tsx`) appears when multiple tasks are selected. Supported actions:

- **Move** — Move selected tasks to a different column
- **Change priority** — Set priority on all selected tasks
- **Delete** — Remove all selected tasks

## Accessibility

- **Aria-live announcements** — Screen readers are notified of drag-and-drop actions (pick up, move, drop) via aria-live regions.
- **Keyboard shortcut** — Press `n` to open the new task dialog from anywhere on the board.
