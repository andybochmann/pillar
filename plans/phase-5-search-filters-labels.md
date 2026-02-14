# Phase 5 — Search, Filters & Labels

## Goal

Add search, filtering, label management, and bulk operations for power-user productivity.

## Prerequisites

- Phase 4 complete (calendar, recurring tasks)

## Tasks

### 5.1 Global Search

- Command palette using shadcn Command component (or cmdk)
- Triggered by `/` keyboard shortcut or search icon in topbar
- Search tasks by title across all projects
- Results show task title, project name, column, priority
- Click result to navigate to project board and highlight task

### 5.2 Board Filters

- Filter bar above Kanban board columns
- Filter by: priority (multi-select), label (multi-select), due date range, assignee (future)
- Active filters shown as removable chips
- Filtered-out tasks hidden from columns (with count indicator)
- Clear all filters button

### 5.3 Label Management

- Label picker component for task detail Sheet
- Autocomplete from existing labels in the project
- Color presets (8-10 colors) assigned to labels
- Create new label inline
- Label CRUD API: GET/POST/PATCH/DELETE `/api/labels`
- Labels scoped per user (shared across projects)

### 5.4 Bulk Operations

- Multi-select tasks with Shift+click or checkbox mode
- Floating action bar when tasks selected: move to column, change priority, delete
- Bulk move: select target column from dropdown
- Bulk delete: confirmation dialog with count
- Select all in column

### 5.5 Tests

- **Component tests**: Command palette search, filter bar, label picker, bulk action bar
- **E2E tests**: Search for task and navigate, apply filters and verify hidden tasks, create/assign labels, bulk select and move

## Files to Create/Modify

```
src/components/search/command-palette.tsx     # NEW
src/components/kanban/board-filters.tsx       # NEW
src/components/tasks/label-picker.tsx         # NEW
src/components/kanban/bulk-actions.tsx         # NEW
src/app/api/labels/route.ts                   # NEW
src/app/api/labels/[id]/route.ts              # NEW
src/models/label.ts                           # NEW — name, color, userId
src/components/kanban/kanban-board.tsx         # MODIFY — filters, bulk select
src/components/kanban/task-card.tsx            # MODIFY — selection checkbox
src/components/tasks/task-sheet.tsx            # MODIFY — label picker
src/app/layout.tsx                            # MODIFY — mount command palette
```

## Acceptance Criteria

- [ ] User can search tasks globally with `/` shortcut
- [ ] Search results navigate to the correct project board
- [ ] Kanban board has working filters for priority, label, due date
- [ ] User can create, assign, and manage colored labels
- [ ] User can multi-select tasks and perform bulk move/delete
- [ ] All features have corresponding tests
