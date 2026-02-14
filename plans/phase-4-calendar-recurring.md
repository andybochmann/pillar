# Phase 4 — Calendar View & Recurring Tasks

## Goal

Build the calendar page showing tasks by due date and fully implement the recurring tasks UI.

## Prerequisites

- Phase 3 complete (overview page, column management)
- shadcn Calendar component already installed

## Tasks

### 4.1 Calendar Page — Monthly View

- Monthly calendar grid with tasks placed on their due dates
- Tasks shown as compact pills/chips with title and priority color
- Color-coded by project or priority (user toggle)
- Navigate between months (prev/next arrows)
- Today highlighted
- Click a date to see day detail

### 4.2 Day Detail View

- Click a calendar date to expand a panel showing all tasks due that day
- Inline task editing (click to open task Sheet from Phase 2)
- Quick-create task for that date
- Show tasks grouped by project

### 4.3 Recurrence UI

- Add recurrence picker to the task detail Sheet
- Fields: frequency (daily/weekly/monthly/yearly/none), interval (every N), end date (optional)
- Visual indicator on calendar for recurring tasks (repeating icon)
- Preview: "Repeats every 2 weeks until Mar 15"

### 4.4 Recurrence Completion Flow

- When marking a recurring task complete:
  - Set `completedAt` on current instance
  - API spawns next occurrence (already implemented in PATCH route)
  - Toast shows "Task completed. Next occurrence created for [date]"
  - Calendar updates to show new occurrence
- Handle end date: no new occurrence if past end date

### 4.5 Drag Tasks on Calendar

- Drag a task pill from one date to another to change its due date
- Optimistic update + API PATCH
- Visual feedback during drag (ghost pill, drop target highlight)

### 4.6 Tests

- **Component tests**: Calendar month view rendering, day detail panel, recurrence picker
- **E2E tests**: Navigate months, click date, create task on date, complete recurring task and verify next occurrence, drag to reschedule

## Files to Create/Modify

```
src/app/(dashboard)/calendar/page.tsx        # MODIFY — full implementation
src/components/calendar/calendar-view.tsx     # NEW — monthly grid
src/components/calendar/calendar-day.tsx      # NEW — day cell with task pills
src/components/calendar/day-detail.tsx        # NEW — expanded day panel
src/components/tasks/recurrence-picker.tsx    # NEW
src/components/tasks/task-sheet.tsx           # MODIFY — add recurrence picker
src/components/kanban/task-card.tsx           # MODIFY — recurrence display
```

## Acceptance Criteria

- [ ] Calendar shows monthly grid with tasks on their due dates
- [ ] User can navigate between months
- [ ] Clicking a date shows tasks for that day
- [ ] User can set recurrence on any task (frequency, interval, end date)
- [ ] Completing a recurring task spawns the next occurrence
- [ ] User can drag tasks between dates to reschedule
- [ ] All calendar features have tests
