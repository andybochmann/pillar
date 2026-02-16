# Napkin — Pillar Project

## Mistakes & Lessons

### MongoDB transactions require replica set
- All 4 DELETE routes used `mongoose.startSession()` + `startTransaction()` which fails silently on standalone MongoDB
- Fixed by removing transactions and using sequential operations
- **Rule**: Never use MongoDB transactions in this project — standalone server only

### Owner loses access after sharing project
- `getAccessibleProjectIds` fallback logic was too restrictive: it excluded owned projects if ANY ProjectMember record existed (even if the owner wasn't one)
- Root cause: POST members route didn't auto-create owner's ProjectMember record when first member was added
- Fixed both: simplified fallback to always include `Project.userId` projects, and auto-create owner record in POST route

### Share dialog missing role change
- `updateMemberRole` existed in hook but was never wired to UI — static Badge showed "Editor" with no interaction
- Fixed by adding Select dropdown for non-owner members when viewed by owner

### DnD hydration mismatch
- `DndContext` without a stable `id` prop causes SSR hydration mismatches in React 19
- Fixed by adding `id="kanban-dnd"` to the DndContext in kanban-board.tsx

### Radix accessibility warnings
- Every Dialog needs `DialogDescription` and every Sheet needs `SheetDescription` — even if hidden with `sr-only`
- Without these, Radix logs console warnings and `aria-describedby` is missing
- Some residual Radix warnings still appear even WITH the elements present (cosmetic, known Radix behavior)

### Mongoose 9: returnDocument not new
- `findOneAndUpdate` in Mongoose 9 uses `{ returnDocument: "after" }`, not `{ new: true }`
- Found this bug in settings/profile PATCH route

### Task title sync in Sheet
- Title only saved on blur via debounced `saveField()`. Closing sheet via Escape could lose unsaved changes.
- Fixed by adding `saveTitleIfChanged()` flush on Enter key and useEffect cleanup

### Stale task counts in project header
- Server-rendered `taskCounts` prop never updated after client-side task changes
- Fixed with `onTasksChange` callback pattern: child reports changes to parent, parent computes counts via useMemo

### React 19 useRef requires initial value
- `useRef<T>()` without arguments fails TypeScript in React 19 — must pass initial value
- Fix: `useRef<T>(undefined!)` or `useRef<T>(null)` depending on the type
- Found in `use-realtime-sync.ts` during build

### Test: await user.click() waits for full async handler
- `userEvent.click()` awaits the entire async onClick handler chain including fetch
- To test intermediate loading states, use `fireEvent.click()` + `findByText` instead
- Use a never-resolving fetch mock (`new Promise(() => {})`) to freeze loading state
- Found in `generate-subtasks-dialog.test.tsx`

### Notification model types must match schema enum
- Tests used `"due-soon"` type but model only allows `"reminder" | "overdue" | "daily-summary"`
- Always check model enum values when writing test fixtures

### TypeScript closure narrowing
- TypeScript can't narrow outer variables inside nested function closures
- `if (!x) return` guard doesn't narrow `x` inside a `function tick() { ... }` defined after
- Fix: use non-null assertion `x!` inside the closure when guard ensures it's defined

## Patterns That Work
- `onTasksChange` callback from child to parent for reactive derived state (avoids prop drilling server data)
- `vi.hoisted()` for session mocks in API route tests
- Playwright with `waitUntil: 'domcontentloaded'` instead of `networkidle` when SSE keeps connections open
- `keyboard.type(text, { delay: 80 })` in Playwright for React controlled inputs (instead of `fill()`)

## Patterns That Don't Work
- `page.fill()` in Playwright for React controlled inputs — doesn't trigger React state updates reliably
- `waitUntil: 'networkidle'` with SSE endpoints — SSE keeps the connection open, causing timeouts
- Mongoose `{ new: true }` in v9 — silently uses wrong option name
