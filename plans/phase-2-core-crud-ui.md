# Phase 2 — Core CRUD UI (Category, Project, Task Editing)

## Goal

The API layer is complete but the frontend has no way to create/edit/delete categories, projects, or tasks beyond `prompt()`. This phase makes the app actually usable.

## Prerequisites

- Phase 1 complete (models, API routes, auth, basic Kanban board)

## Tasks

### 2.1 Shared Types

- Create `src/types/index.ts` with shared interfaces: `Category`, `Project`, `Task`, `Column`, `Priority`, `Recurrence`
- Extract from inline duplicates across components (sidebar, kanban-board, task-card)
- Add serialized variants (string dates) for client-side use

### 2.2 Custom Hooks

- Create `src/hooks/use-categories.ts` — fetch, create, update, delete categories with SWR-like pattern
- Create `src/hooks/use-projects.ts` — fetch, create, update, delete, archive projects
- Create `src/hooks/use-tasks.ts` — fetch, create, update, delete, move tasks
- Each hook: loading state, error state, optimistic updates, cache invalidation

### 2.3 Create Category Dialog

- Dialog component in sidebar with fields: name, color picker, icon selector
- POST to `/api/categories`
- Auto-increment order
- Toast on success/error
- Sidebar re-fetches after creation

### 2.4 Create Project Dialog

- Dialog accessible from sidebar category group (+ button next to category name)
- Fields: name, description, assign to category
- Default columns auto-populated (To Do / In Progress / Review / Done)
- POST to `/api/projects`
- Sidebar re-fetches after creation

### 2.5 Task Detail Sheet

- shadcn Sheet (slide-over panel) opens when clicking a task card
- Editable fields: title, description (textarea), priority (select), due date (date picker), labels (tag input), recurrence (frequency + interval + end date), column assignment (select)
- Auto-save on blur or debounced input (PATCH to `/api/tasks/[id]`)
- Delete button with confirmation dialog
- Mark complete button (sets `completedAt`, triggers recurrence spawning)

### 2.6 Task Creation Form

- Replace `prompt()` in KanbanBoard with inline form at bottom of column
- Fields: title (required), priority (optional, default medium)
- Enter to submit, Escape to cancel
- POST to `/api/tasks` with columnId from the column it's in

### 2.7 Delete Confirmations

- Reusable `ConfirmDialog` component wrapping shadcn AlertDialog
- Wire up for: delete task, delete project (warns about task deletion), delete category (warns about project orphaning)

### 2.8 Toast Notifications

- Wire up `toast()` calls from sonner for all CRUD operations
- Success: "Task created", "Project updated", etc.
- Error: Show API error message

### 2.9 Tests

- **Unit tests**: Custom hooks (mock fetch, test loading/error/success states)
- **Component tests**: Category dialog, Project dialog, Task detail Sheet, ConfirmDialog
- **E2E tests**: Full create → edit → delete flows for category, project, and task

## Files to Create/Modify

```
src/types/index.ts                          # NEW — shared types
src/hooks/use-categories.ts                 # NEW
src/hooks/use-projects.ts                   # NEW
src/hooks/use-tasks.ts                      # NEW
src/components/categories/create-dialog.tsx  # NEW
src/components/projects/create-dialog.tsx    # NEW
src/components/tasks/task-sheet.tsx          # NEW
src/components/tasks/task-form.tsx           # NEW
src/components/shared/confirm-dialog.tsx     # NEW
src/components/kanban/kanban-board.tsx       # MODIFY — use hooks, inline form
src/components/kanban/kanban-column.tsx      # MODIFY — inline task form
src/components/kanban/task-card.tsx          # MODIFY — click opens Sheet
src/components/layout/sidebar.tsx            # MODIFY — add create buttons
```

## Acceptance Criteria

- [ ] User can create a category from the sidebar
- [ ] User can create a project within a category
- [ ] User can create a task with title in a column
- [ ] User can click a task to open detail Sheet and edit all fields
- [ ] User can delete tasks, projects, and categories with confirmation
- [ ] Toast notifications appear for all CRUD operations
- [ ] All new components have unit/component tests
- [ ] E2E test covers create → edit → delete for each entity
