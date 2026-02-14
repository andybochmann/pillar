# Phase 6 — Polish, Error Handling & Mobile

## Goal

Production-quality UX with loading states, error handling, responsive layout, and accessibility.

## Prerequisites

- Phase 5 complete (search, filters, labels)

## Tasks

### 6.1 Loading Skeletons

- Skeleton states for: Kanban board (column shells + card placeholders), sidebar (nav items), dashboard cards, task detail Sheet, overview table, calendar grid
- Use shadcn Skeleton component (already installed)
- Show during initial data fetch and route transitions

### 6.2 Error Boundaries

- `error.tsx` at `(dashboard)/` route group level — catches render errors with retry button
- `not-found.tsx` at `(dashboard)/projects/[id]/` — "Project not found" with back link
- `error.tsx` at `(auth)/` level — auth error display
- Global `error.tsx` at app root as final fallback

### 6.3 Responsive / Mobile Layout

- Sidebar as overlay sheet on mobile (< 768px) with hamburger toggle in topbar
- Topbar component with app title, hamburger menu, and user avatar
- Kanban columns scroll horizontally on mobile
- Task cards stack full-width on small screens
- Calendar switches to list view on mobile
- Touch-friendly tap targets (min 44px)

### 6.4 Settings Page

- Route: `/settings`
- Profile section: edit name, upload avatar image
- Account section: change password (current + new + confirm)
- Preferences section: default priority, default view (board/list)
- Danger zone: delete account with confirmation

### 6.5 Keyboard Shortcuts

- `n` — create new task (opens form in current column or first column)
- `/` — open search (from Phase 5)
- `Escape` — close Sheet/dialog/search
- `?` — show keyboard shortcuts help dialog
- Arrow keys — navigate between task cards (accessibility)

### 6.6 Accessibility Audit

- ARIA labels on all interactive elements
- Focus management: trap focus in dialogs, restore on close
- Screen reader announcements for DnD operations
- Color contrast compliance (WCAG AA)
- Skip-to-content link

### 6.7 Tests

- **E2E mobile tests**: Use Pixel 5 project in Playwright config (already set up)
- **Component tests**: Skeleton rendering, error boundary recovery, responsive sidebar
- **Accessibility tests**: axe-core integration in component tests

## Files to Create/Modify

```
src/app/(dashboard)/error.tsx                # NEW
src/app/(dashboard)/projects/[id]/not-found.tsx  # NEW
src/app/(auth)/error.tsx                     # NEW
src/app/error.tsx                            # NEW
src/components/layout/topbar.tsx             # NEW — mobile header
src/components/layout/sidebar.tsx            # MODIFY — responsive overlay
src/components/layout/keyboard-shortcuts.tsx  # NEW
src/app/(dashboard)/settings/page.tsx        # NEW
src/app/(dashboard)/layout.tsx               # MODIFY — topbar, responsive
src/components/kanban/kanban-board.tsx        # MODIFY — horizontal scroll
src/components/calendar/calendar-view.tsx     # MODIFY — mobile list view
```

## Acceptance Criteria

- [ ] All pages show skeleton loading states during data fetch
- [ ] Error boundaries catch and display errors gracefully with retry
- [ ] App is fully usable on mobile (sidebar overlay, horizontal scroll, touch targets)
- [ ] Settings page allows profile editing and password change
- [ ] Keyboard shortcuts work and help dialog lists them
- [ ] Passes automated accessibility checks (axe-core)
- [ ] Mobile E2E tests pass in Pixel 5 viewport
