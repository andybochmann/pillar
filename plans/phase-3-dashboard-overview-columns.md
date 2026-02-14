# Phase 3 — Dashboard, Overview & Column Management

## Goal

Make the dashboard show real data, build the cross-project overview page, and allow users to customize Kanban columns.

## Prerequisites

- Phase 2 complete (CRUD UI, hooks, shared types)

## Tasks

### 3.1 Live Dashboard Cards

- Replace hardcoded `0` values in dashboard with actual MongoDB queries
- Overdue: tasks where `dueDate < today` and `completedAt` is null
- Due Today: tasks where `dueDate` is today
- Due This Week: tasks where `dueDate` is within next 7 days
- Create API endpoint or use server component with direct DB queries
- Show clickable counts that link to filtered overview

### 3.2 Overview Page

- Cross-project task list showing all user's tasks
- Filters: priority, due date range, project, label, completion status
- Sort by: due date, priority, created date
- Grouped view option: by project or by priority
- Table/list layout (not Kanban — that's per-project)
- Pagination or virtual scrolling for large task lists

### 3.3 Column Management UI

- Project settings panel (gear icon on board header)
- Add new column with name
- Rename existing columns inline
- Reorder columns via drag-and-drop
- Delete column (must move tasks to another column first)
- Wire to PATCH `/api/projects/[id]` with updated columns array

### 3.4 Project Archive/Unarchive

- Archive button in project settings
- Archived projects hidden from sidebar by default
- Toggle "Show archived" in sidebar footer
- Archived projects show a banner and are read-only
- Unarchive button to restore

### 3.5 Within-Column Task Reordering

- Fix DnD order recalculation for same-column moves
- Recalculate fractional order values (or reindex) on drop
- API endpoint: PATCH task order within column
- Optimistic update with rollback on failure

### 3.6 Tests

- **API tests**: Categories routes, Projects routes, Tasks routes (all CRUD + edge cases)
- **Component tests**: Overview filters, column management panel
- **E2E tests**: Dashboard card counts, overview filtering, column add/rename/delete/reorder

## Files to Create/Modify

```
src/app/(dashboard)/page.tsx                # MODIFY — live queries
src/app/(dashboard)/overview/page.tsx       # MODIFY — full implementation
src/components/overview/task-list.tsx        # NEW
src/components/overview/task-filters.tsx     # NEW
src/components/projects/column-manager.tsx   # NEW
src/components/projects/project-settings.tsx # NEW
src/components/kanban/kanban-board.tsx       # MODIFY — column management, reorder fix
src/components/layout/sidebar.tsx            # MODIFY — archive toggle
src/app/api/tasks/route.ts                  # MODIFY — add overview query params
```

## Acceptance Criteria

- [ ] Dashboard shows accurate overdue/today/this-week counts
- [ ] Overview page lists all tasks with working filters and sort
- [ ] User can add, rename, reorder, and delete columns on a project
- [ ] User can archive and unarchive projects
- [ ] Tasks can be reordered within a column via drag-and-drop
- [ ] All new features have corresponding tests
