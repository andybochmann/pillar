# Pillar — Code Review & Bug Hunt Report

**Date:** 2026-07-11
**Scope:** Full repository — API route handlers, auth/security, data models & core libs, client hooks & state, UI components & UX, and the offline/PWA/SSE sync stack.
**Method:** Six parallel focused reviews, each reading the actual implementation (plus colocated tests) and verifying every finding against the code. The three critical items were additionally re-verified by hand for this report.

---

## Executive Summary

Pillar is a mature, well-structured codebase — conventions are followed consistently (auth-before-DB, `await params`, `returnDocument: "after"`, per-route Zod schemas, targeted SSE emission, hashed MCP tokens, correct role hierarchy in `project-access.ts`). The bugs below are real defects hiding inside that structure, not sloppiness.

**Headline risks (fix first):**

1. **Backup restore deletes other members' tasks** — a viewer on a shared project can trigger irreversible cross-user data loss. *(critical, data loss + authz bypass)*
2. **Offline edits corrupt entities in-place** — any offline PATCH replaces the full task/note/notification with just the patched fields plus a fake ID; the card renders blank and all later edits miss it. *(critical, data integrity)*
3. **Notification dedup index is mis-declared** — a `sparse` *compound* unique index silently indexes every notification, which permanently breaks daily summaries/digests and stops overdue re-notification after a single dismissal. *(critical, background jobs)*
4. **Service worker + offline replay silently discard the offline queue** when the session expires, and cache authenticated pages/SSE streams. *(critical, data loss + cross-user leak on shared devices)*

**Counts:** 4 critical, ~14 high, ~20 medium, ~20 low across functional bugs, security, and UX/accessibility.

### Test-suite status (environment caveat)

`pnpm test` here reports 66 failed test *files* — but every one of those failures is `mongodb-memory-server` being unable to download the `mongod` binary (HTTP 403 through the sandbox proxy), i.e. an environment limitation, **not** a code defect. The tests that don't need MongoDB all pass: **1310 passed, 0 real failures, 750 skipped.** Several tests were noted during review to assert *buggy* behaviour or use unrealistic fixtures that mask bugs (called out inline below). On a machine with database access the DB-backed suites should be run to confirm the fixes.

---

## Critical

### C1 — Backup restore deletes tasks in shared projects you don't own
`src/app/api/settings/backup/route.ts:285`, `:554-556`

Restore collects "old task IDs" from `getAccessibleProjectIds(userId)` — which returns **every** project the user can see, including ones they're only a **viewer** on — then `Task.deleteMany({ _id: { $in: oldTaskIds } })` (line 555) and `Notification.deleteMany({ taskId: { $in: oldTaskIds } })` (line 556) delete them all.

**Failure scenario:** User B is a viewer on User A's project. B uploads any valid backup file → all of A's tasks (and other members' notifications for them) are permanently deleted, with no SSE notification to A. A viewer cannot even edit a single task through the normal API, yet can wipe the whole project here. Irreversible.

**Fix:** Scope the deletion to projects the user *owns*, mirroring the export path (which uses `Project.find({ userId })`). Collect `oldTaskIds` from owned-project IDs only; keep the collaborator-task cleanup (line 554) scoped to `oldProjectIds` (owned) as it already is.

### C2 — Offline mutations corrupt entities in client state
`src/lib/offline-fetch.ts:39` (+ every consuming hook)

For a queued offline mutation, `offlineFetch` returns a synthetic body `{ ...body, _id: "offline-<uuid>" }` for **PATCH as well as POST**. Every hook then does `setX(prev => prev.map(t => t._id === id ? updated : t))` — replacing the whole entity with only the patched fields.

**Failure scenario:** Offline, drag a task to another column (`PATCH {columnId}`). The card in state becomes `{ columnId, _id: "offline-…" }` — title, labels, subtasks, order all gone; it renders blank. Because its `_id` changed to a fake value, every later edit/complete/archive targets the old id and silently misses, and the queued follow-up PATCH to `/api/tasks/offline-…` 404s on replay and is dropped as "permanent." Same corruption for offline "mark notification read" and offline unarchive (`use-archived-tasks.ts` — synthetic `projectId` is `undefined`, so the task never reaches the board).

**Fix:** For PATCH, don't fabricate a new `_id`; echo `{ ...body, _id: <id parsed from the URL> }` and have hooks **merge** (`{ ...t, ...updated }`) rather than replace. This also fixes the tempId problem for POST replay (see C4).

### C3 — Notification dedup unique index indexes every document
`src/models/notification.ts:86-89`

The index `{ taskId, userId, type, scheduledFor }` is declared `{ unique: true, sparse: true }`. A **sparse compound** index only skips a document when it's missing *all* keys; `userId` and `type` are always present, so every notification is indexed, with missing `taskId`/`scheduledFor` stored as `null`.

**Failure 1 — daily summaries/digests permanently break:** Daily-summary notifications have no `taskId` and no `scheduledFor`, so day 1 and day 2 for the same user share the key `{null, userId, "daily-summary", null}`. The `Notification.create` at `notification-worker.ts:542` is **not** wrapped in the E11000 try/catch used elsewhere, so day 2 throws — aborting `processDailySummary` for all remaining users and skipping `processOverdueDigest` entirely, on every 2-minute tick, forever.

**Failure 2 — overdue tasks never re-notified:** Per-task overdue notifications have no `scheduledFor`; a second one for the same task+user collides with the first. Once the user dismisses the first (or "clear all" sets `dismissed: true`), the worker's dedup query (`dismissed: false`) misses the old row, `create` hits E11000, the catch `continue`s, and the user never gets another overdue notification for that task.

**Fix:** Make the unique index **partial**, scoped to types that actually carry `scheduledFor` (e.g. `partialFilterExpression: { scheduledFor: { $exists: true } }`), move overdue dedup to an application-level key that includes a generation marker (e.g. `dueDate`), and wrap the summary/digest `create` calls in the same E11000-swallowing handler used by the reminder path. Requires dropping/rebuilding the index in a migration.

### C4 — Service worker & offline replay silently lose the queue, and cache authenticated content
`public/sw.js`, `src/lib/sync.ts:21`

Several distinct but related defects in the offline stack:

- **Auth redirect treated as success (data loss)** — `src/lib/sync.ts:21` & `public/sw.js:284`: when the JWT has expired, `proxy.ts` returns 302→`/login`; `fetch` follows it, the login page returns 200, `res.ok` is true → the mutation is deleted from the queue as "success" without ever reaching the API. Work offline, session expires, come back online → the **entire queue is silently discarded** (with a success toast). The notification-action paths already guard `res.redirected`; the replay paths don't.
- **No tempId → realId mapping (data loss)** — offline POST returns `offline-<uuid>`; any dependent PATCH/DELETE replays against that fake id, 400/404s, and is dropped. Create-then-edit offline loses the edit. (C2's fix is a prerequisite.)
- **SSE stream gets cached (memory leak)** — `sw.js` `networkFirst` excludes only `/api/auth`, so the `/api/events` EventSource GET is intercepted and `cache.put` on a never-ending 200 body buffers forever and never settles.
- **Authenticated pages survive logout (cross-user leak)** — `CLEAR_AUTH_CACHE` (`clear-auth-cache.ts:16`, `sw.js:181`) clears only `pillar-api-v1`; `pillar-pages-v1` (dashboard HTML + RSC payloads) is untouched. On a shared device, after User A logs out, User B can go offline and navigate to `/projects/…` and be served A's cached board.
- **Redirected responses poison the page cache** — `networkFirstNavigation` caches a 302→`/login` under the requested URL, so offline navigation shows the login page even after re-auth, and replaying a `redirected: true` response to a navigation throws in Chromium.

**Fix:** In both replayers treat `res.redirected || !res.url.includes("/api/")` as a transient failure (keep queued, prompt re-login). Early-return for `/api/events` (or skip caching `text/event-stream`) in the fetch handler. Delete `PAGE_CACHE_NAME` in `CLEAR_AUTH_CACHE`. Guard `cache.put` with `response.ok && !response.redirected` in both `networkFirst` and `networkFirstNavigation`. Implement tempId rewriting on POST replay.

---

## High

### Data integrity / correctness

- **H1 — Recurring task's next occurrence never appears in the completing tab.** `tasks/[id]/route.ts:304`, `complete/route.ts:164`: the server-created next occurrence is announced only via an SSE `created` event stamped with the **requester's** sessionId, which `events/route.ts:52` suppresses for the originating tab; `use-tasks.ts` does no refetch after `updateTask`. Complete a weekly task → next week's task exists in the DB but is invisible on your board until reload. **Fix:** return the created occurrence in the PATCH response and append it client-side, or emit the side-effect event with `sessionId: ""`.

- **H2 — Duplicate recurring tasks from concurrent completes.** `complete/route.ts:27-92`, `tasks/[id]/route.ts:250-317`: the "already completed?" check is a stale read followed by an unconditional `findByIdAndUpdate` (no `completedAt: null` filter); standalone Mongo has no transactions. Double-click or offline-replay → two next occurrences. **Fix:** `findOneAndUpdate({ _id, completedAt: null }, …)` and only spawn when it matched.

- **H3 — `complete_task` MCP tool has no already-completed guard.** `mcp-tools/tasks.ts:391-486`: every repeat call re-sets `completedAt` and spawns another occurrence (and uses hardcoded `order: 0`, colliding with the top task). An AI agent retry duplicates future tasks. **Fix:** return early when `existing.completedAt` is set; compute `maxOrder + 1`.

- **H4 — Bulk move applies one `columnId` across tasks from multiple projects without validation.** `tasks/bulk/route.ts:82-130`: selecting tasks spanning projects A and B and moving to `"review"` (which exists only in A) sets B's tasks to a non-existent column (they vanish from B's board), and the per-project last-column `completedAt` logic misfires. **Fix:** reject (400) any target project whose columns don't contain `columnId`, or skip those tasks.

- **H5 — REST task create/update accept any `columnId`.** `tasks/route.ts:141-230`, `tasks/[id]/route.ts:19`: no validation against `project.columns` (the MCP tools validate). `POST/PATCH {columnId:"nonexistent"}` → task invisible on board and in counts. **Fix:** validate against `project.columns` like the MCP path.

- **H6 — `recalculateRemindersForUser` never updates auto-scheduled reminders.** `reminder-scheduler.ts:169`: the `!t.reminderAt` filter excludes every task that already has a reminder, but auto reminders also set `reminderAt`, so changing due-date-reminder preferences updates nothing. The passing test uses an unrealistic fixture (auto task with no `reminderAt`) that masks this. **Fix:** persist a `reminderSource: "auto"|"manual"` flag and filter on it.

- **H7 — `db.ts` caches a rejected connection promise forever.** `db.ts:35-40`: `cached.promise` is never reset on rejection, so one transient MongoDB outage makes every subsequent `connectDB()` await the rejected promise → all requests 500 until the process restarts. **Fix:** `cached.promise = mongoose.connect(...).catch(e => { cached.promise = null; throw e; })`.

- **H8 — `fetchProjects` registered directly as a DOM event listener.** `use-projects.ts:209`: `useRefetchOnReconnect(fetchProjects)` passes the `CustomEvent` as the `includeArchived` argument, so after any SSE reconnect or sync-complete all archived projects reappear in the sidebar. **Fix:** wrap in a parameterless `useCallback`.

- **H9 — SSE reconnect gives up permanently after 10 failures.** `use-realtime-sync.ts:52`: ~3.5 min of server unavailability (a deploy) exhausts retries; the tab then silently receives no further realtime updates until an offline→online flap or reload. **Fix:** keep retrying at the 30s cap and/or reset on `visibilitychange`/focus. *(Reported by three reviewers.)*

- **H10 — Overdue notification fires too early (timezone).** `notification-worker.ts:357`: `dueDate: { $lt: now }` against midnight-UTC-stored due dates flags a task overdue the instant its due day *starts* — for users west of UTC, the evening *before* the due date. Inconsistent with `processOverdueDigest`, which correctly uses timezone-local start-of-today. **Fix:** compare against the user's local start-of-today.

### Security (see the Security section for full detail)

- **H11 — Account pre-hijacking via unverified registration + OAuth email linking.** `oauth-linking.ts:46`, `auth/register/route.ts`.
- **H12 — Any user can enumerate all users' emails/names.** `users/search/route.ts` (the "owns a project" gate is satisfied by everyone).
- **H13 — Weak default `AUTH_SECRET` (`change-me-in-production`) enables JWT forgery.** `docker-compose.yml:10`.

### UI / date correctness

- **H14 — Due dates set from the card popover, bulk bar, and calendar drag land one day early for users east of UTC.** `kanban/task-card.tsx:385`, `kanban/kanban-board.tsx:654,660`, `calendar/calendar-day.tsx:37`: these use a *local*-midnight `date.toISOString()`/`.slice(0,10)` instead of the app's UTC-midnight convention (`task-sheet.tsx:329` does it correctly). In UTC+2, picking "Jul 11" stores/persists "Jul 10". **Fix:** normalize via `format(date,"yyyy-MM-dd") + "T00:00:00Z"` (writes) and `format(date,"yyyy-MM-dd")` (droppable ids).

- **H15 — Task sheet reopens after being closed when opened via `?taskId=`.** `kanban-board.tsx:82-90`: the effect depends on `[openTaskId, tasks]` and the query param is never cleared, so any task-array change (SSE, drag, subtask toggle) force-reopens the just-closed sheet. **Fix:** clear the `taskId` param after first open, or track a consumed ref.

- **H16 — In-progress title/description edit wiped by an SSE update.** `tasks/sections/task-title-description-section.tsx:32-42`: the sync guard `!debounceRef.current` is null while *typing* (the debounce only starts on blur), so a concurrent update resets the textarea mid-keystroke. **Fix:** skip sync while the field is focused/dirty.

- **H17 — Bulk Delete destroys up to the whole board with no confirmation.** `kanban/bulk-actions-bar.tsx:240-247`: every other permanent delete confirms; this one fires immediately, adjacent to Archive/Cancel. **Fix:** add a `ConfirmDialog`.

---

## Medium

### Functional

- **M1 — Keyboard-nav side effects run inside a `setState` updater.** `use-kanban-keyboard-nav.ts:98-133`: `onOpenTask`/`onCyclePriority`/`onToggleComplete`/`onToggleSelect`/`onOpenDatePicker` are called inside `setFocusedTaskId`'s updater, which must be pure. StrictMode (dev) double-invokes and React Compiler may replay → `p` cycles two steps, `c` fires two PATCHes, `x` toggles on-then-off. **Fix:** read the focused id from a ref and call callbacks outside the updater. *(Two reviewers.)*
- **M2 — Category DELETE doesn't notify shared-project members.** `categories/[id]/route.ts:99-152`: cascade-deletes shared projects but emits only an untargeted `category deleted` event — members' boards keep rendering deleted data and their writes 404. **Fix:** collect member userIds per project and emit targeted `project deleted` events.
- **M3 — Stats counts include archived tasks.** `stats/task-counts/route.ts:34`, `stats/overdue-count/route.ts:33`: the board excludes archived, these don't, so archiving an overdue task leaves it counted in the sidebar/overdue badge. **Fix:** add `archived: { $ne: true }`.
- **M4 — `update_project` MCP tool doesn't remap orphaned tasks.** `mcp-tools/projects.ts:127-183`: unlike the REST handler, removing a column via MCP leaves tasks stranded in a non-existent column. **Fix:** reuse the REST orphan-remap.
- **M5 — MCP `computeNextDueDate` overflows month/year math.** `mcp-tools/tasks.ts:500-515`: native `setMonth`/`setFullYear` turn Jan 31 + 1mo into Mar 3 and Feb 29 + 1yr into Mar 1, diverging from the date-fns REST path. **Fix:** delete the duplicate; import `getNextDueDate` from `@/lib/date-utils`.
- **M6 — Recurring next occurrence loses its reminder.** `complete/route.ts:143-162`, `tasks/[id]/route.ts:283-302`, `mcp-tools/tasks.ts:457-473`: `scheduleNextReminder` is never called for the spawned occurrence, so recurring tasks silently stop reminding after the first completion. **Fix:** call `scheduleNextReminder(newTask._id)` after creating it.
- **M7 — Reminder not cleared when no user is notifiable.** `notification-worker.ts:317`: `reminderAt` is only cleared when someone was notified, so a task whose users all disabled notifications is re-processed every tick and fires a stale reminder weeks later. **Fix:** advance/clear `reminderAt` for all non-quiet-hours skips.
- **M8 — In-app notification opt-out ignored when push is on.** `notification-worker.ts:31-32,107-116`: a user with `enableInAppNotifications:false` + `enableBrowserPush:true` still gets an in-app record + SSE emit. **Fix:** gate the in-app record/emit on `enableInAppNotifications`.
- **M9 — Duplicate EventSource connections after a reconnect race.** `use-realtime-sync.ts:60-64`: the backoff timer calls `connect()` without checking `esRef.current`, so an `online` handler + a pending timer can create two live EventSources; the orphan leaks and every event fires twice (double refetches, double desktop notifications). **Fix:** bail if `esRef.current` is already set.
- **M10 — `queueCount` goes stale; auto-sync never triggers on flaky networks.** `offline-queue.ts` / `use-offline-queue.ts:111-125`: queuing doesn't notify the hook, so when `navigator.onLine` is true but fetch throws (captive portal), the badge shows 0 and app-level auto-sync never fires. **Fix:** dispatch a `pillar:queue-changed` event from `addToQueue`/`removeFromQueue`.
- **M11 — Missed-event catch-up incomplete.** `use-notes.ts`, `use-filter-presets.ts`, `use-project-members.ts` (and `use-archived-tasks.ts`) don't use `useRefetchOnReconnect`; since the SSE endpoint has no replay, these entities permanently miss events during a disconnect and never reconcile offline-created items. **Fix:** add `useRefetchOnReconnect` to them.
- **M12 — `use-user-search` spinner can stick; stale results can win.** `use-user-search.ts:99-118`: `clear()` cancels the debounce without resetting `loading`, and out-of-order responses aren't guarded. **Fix:** `setLoading(false)` in `clear()`; add an AbortController/sequence counter.
- **M13 — `dismissAll` notifications has no rollback.** `use-notifications.ts:258-269`: on server 500 the list stays empty locally until a manual refetch. **Fix:** snapshot and restore on error.
- **M14 — Command palette results can be stale/out-of-order; errors swallowed.** `search/command-palette.tsx:121-141`: no request sequencing/abort and no `catch`. **Fix:** request counter/AbortController + error state.
- **M15 — Deletable column containing only archived tasks strands them.** `column-manager.tsx` + `project-view.tsx:237`: `hasTasksInColumn` checks only live tasks; after deletion, restoring an archived task yields a `columnId` matching no column. **Fix:** consider archived tasks in the guard, or remap on restore.
- **M16 — Silent failures with no user feedback:** subtask-add success toast fires on failure (`task-sheet.tsx:400-410`); project rename/description/view/archive and ColumnManager save have no `catch` (`project-settings.tsx:57-85`, `column-manager.tsx:190-198`); calendar day-detail task create swallows errors (`day-detail.tsx:113-128`). **Fix:** wrap in try/catch with `toast.error`; move success toasts inside `try`.
- **M17 — `reminderAt` snooze emits no sync event.** `tasks/[id]/snooze/route.ts:60-70`: other tabs/members show a stale reminder. **Fix:** emit a task `updated` event.

### Security

- **M18 — MCP access tokens never expire and have no scope limits.** `settings/tokens/route.ts:66`, `access-token.ts:31`: `expiresAt` defaults to `null` (= valid forever) and every token is full read/write on all reachable projects. **Fix:** allow/require `expiresAt` with a max lifetime; consider scopes. *(Entropy and hashed-at-rest storage are correct.)*
- **M19 — No rate limiting on registration/login/password-change.** Unbounded online brute-force / credential-stuffing / signup spam. **Fix:** IP- and account-based throttling/lockout.
- **M20 — Weak password policy (min 8, no complexity/breach check).** `auth/register`, `settings/password`. **Fix:** raise the floor and/or add a k-anonymity compromised-password check on both set and change paths.
- **M21 — Error bodies leak internals / wrong status.** `projects/[id]/members/*`, `tasks/bulk-create/route.ts`: catch-alls return `error.message` with 500, e.g. raw `E11000 …` on a concurrent add-member (should be 409). **Fix:** only surface `error.message` when `error.status` is set; map duplicate-key to 409.

### Non-atomic writes / races

- **M22 — Register and add-member have check-then-create races.** `auth/register/route.ts:34-48`, `members/route.ts:136-145`: concurrent requests both pass the existence check; the second hits the unique index and returns a generic 500. **Fix:** catch E11000 and return the proper 400/409.
- **M23 — Notification worker interval has no overlap guard.** `notification-worker.ts:753`: a tick slower than 2 min overlaps the next; combined with C3 the summary/digest paths race into the unhandled E11000. **Fix:** add an `isRunning` flag.

---

## Low

### Functional / correctness
- **L1** — Unhandled `CastError` → 500 (should be 400) on invalid ObjectId query params: `tasks/route.ts:81,85,93`, `notes/route.ts:43`, `notifications/route.ts:40`, `projects/route.ts:45`.
- **L2** — Backup restore deletes `NotificationPreference` before re-create inside the try; if create throws, preferences aren't restored by the rollback. `backup/route.ts:503-541`.
- **L3** — DST single-pass offset bug in `computeReminderDate` — reminders land 1 hr off on transition days. `reminder-scheduler.ts:30-100`.
- **L4** — Monthly recurrence computed from the previous occurrence drifts permanently (Jan 31 → Feb 28 → Mar 28 → …). `date-utils.ts:49-66`. **Fix:** anchor to the original day-of-month.
- **L5** — Out-of-order refetch can clobber optimistic state (no AbortController/generation token): `use-tasks.ts:56-75`, `use-notifications.ts:150`, `use-project-members.ts:106`, `use-notes.ts:32`.
- **L6** — Raw `fetch()` for mutations (convention + behaviour): `use-push-subscription.ts:52,91` (also ignores the DELETE result → returns `true` on failure), `use-generate-tasks.ts:172` (omits `X-Session-Id`).
- **L7** — Time-tracking start/stop is last-writer-wins with no ordering guard; offline start/stop gives no UI feedback (synthetic `_id` matches nothing). `use-time-tracking.ts:120-158`.
- **L8** — `requestPermission` doesn't notify the `useSyncExternalStore` subscription, so the settings toggle stays on "default" until visibility changes. `use-notification-permission.ts:130-141`.
- **L9** — `use-precache` `cancelled` flag doesn't stop the fetch loop after unmount. `use-precache.ts:76-101`.
- **L10** — Bulk-move optimistic update doesn't mirror server `completedAt` handling → wrong strikethrough until refetch. `kanban-board.tsx:558-562`.
- **L11** — Filter-preset save: Enter bypasses the `saving` guard → duplicate presets. `filter-preset-selector.tsx:167-169`.
- **L12** — Save-status indicator reports "Saved" in `finally` even after a failed save. `task-title-description-section.tsx:89-98`.
- **L13** — `markdown-editor` `value` is initial-only; future consumers passing changed `value` get a stale editor. `markdown-editor.tsx:40-55`.
- **L14** — Date-picker clicking the selected day closes without clearing/changing — looks like a clear that didn't happen. `date-picker.tsx:79-84`.
- **L15** — Offline replay order undefined for same-millisecond mutations (random UUID key + ms timestamp). `offline-queue.ts:18-34`. **Fix:** `autoIncrement` key or monotonic counter.
- **L16** — Permanently-failed (4xx) offline mutations dropped with no usable feedback; SW `permanentFailures` ignored by `onSwMessage`. `sync.ts:42`, `use-offline-queue.ts:129`.
- **L17** — Lost mid-flight mutation (response lost after server applied it) is re-queued and double-applied — no idempotency key. `offline-fetch.ts:26-33`.
- **L18** — `notification-scheduler.generateNotificationsForTask` is dead code referenced only by its own tests, and its overdue dedup ignores `dismissed`. `notification-scheduler.ts:58`. **Fix:** delete or reconcile.
- **L19** — Owner-ProjectMember self-repair upsert is unreachable (runs after `requireProjectRole(...,"owner")` throws 404 for the exact orphan it repairs) → a legacy owner without a membership row is permanently locked out. `members/route.ts` POST.

### Security
- **L20** — Stale JWTs: password change / account deletion don't invalidate existing tokens (JWT sessions, default 30-day maxAge, no revocation). `auth.ts:87-106`. **Fix:** per-user token version / `passwordChangedAt` check.
- **L21** — CSP allows `unsafe-inline` + `unsafe-eval` for scripts. `proxy.ts:11`.
- **L22** — Unauthenticated `mongo-express` (ME_CONFIG_BASICAUTH=false) exposed under the dev compose profile. `docker-compose.yml:55-58`.
- **L23** — SSE stream is only auth-checked at connect; it survives logout/JWT expiry until the tab closes. `api/events/route.ts:11-13`. **Fix:** re-validate the session on the heartbeat.
- **L24** — Account DELETE deletes the user's authored tasks/notes inside *other* owners' shared projects with no SSE to those members, and leaves dangling `assigneeId` references. `settings/profile/route.ts:118-135`.

### UX / Accessibility
- **L25** — Per-item trash in list view deletes with no confirmation (inconsistent with "Delete completed"). `list/list-item.tsx:64-77`.
- **L26** — No SR announcement on successful drop; live region contradictorily `aria-live="assertive"` + `role="status"`. `kanban-board.tsx:290-361,996`.
- **L27** — Hardcoded light-only chip colors break dark mode (due-date/reminder/subtask chips). `task-card.tsx:113-132,419-441`, `overview/task-list.tsx:36-41`.
- **L28** — Overview task rows are clickable `div`s with no `role`/`tabIndex`/key handler — not keyboard-openable. `overview/task-list.tsx:80-84`.
- **L29** — Missing aria-labels on icon-only buttons: `sidebar.tsx:506` (collapsed Sign out), `note-list.tsx:82`, `filter-preset-selector.tsx:119`.
- **L30** — Project names in the sidebar aren't truncated; long titles overflow the 16rem rail. `sidebar.tsx:339-360`. Long unbroken task titles overflow the card (no `break-words`). `task-card.tsx:286-297`.
- **L31** — Command palette shows stale results under the spinner while loading; only `/` opens it (`⌘/Ctrl+K` unbound); sidebar "Search…" synthesizes a fake `/` KeyboardEvent (fragile). `command-palette.tsx:256-261`, `sidebar.tsx:244-248`.
- **L32** — Calendar quick-add silently targets `projects[0]` with no selector/indication. `day-detail.tsx`, `calendar-page-client.tsx:185-192`.
- **L33** — Calendar day `aria-label` hardcodes `"en-US"` locale. `calendar-day.tsx:61`.

---

## Verified NOT vulnerable (checked, no action needed)

To keep the plan focused, these were explicitly examined and found correct: register user-enumeration/timing (password hashed before the existence check, uniform generic error); credentials provider (rejects OAuth-only users, real bcrypt compare); Google `email_verified` enforcement; user-search regex is escaped (no ReDoS/injection); push subscribe/unsubscribe ownership scoping and VAPID key handling; MCP tool authorization (`requireProjectRole` per project, assignee membership validated, `AsyncLocalStorage` prevents userId bleed, tokens SHA-256 hashed + expiry-checked, `tokenHash` projected out of list responses); `project-access.ts` role hierarchy, 403-vs-404, and last-owner protection; SSE listener/heartbeat cleanup; `column-completion.ts`, `time-format.ts`, `share-task.ts`, `ai.ts`; model re-registration guards; no default exports / missing Dialog/Sheet descriptions / default `toast` imports.

---

## Remediation Plan

Work in dependency order — C2's merge-semantics fix is a prerequisite for the C4 tempId work, and C3 needs an index migration. Each phase is independently shippable and test-gated (write/adjust tests first per the repo's mandatory TDD workflow; run the DB-backed suites on a machine with database access).

### Phase 0 — Stop the bleeding (critical, ship immediately)
1. **C1** — Scope backup-restore deletion to owned projects only. *(1 file, small, high urgency.)*
2. **C3** — Convert the notification unique index to a partial index; move overdue dedup to an app-level generation key; wrap summary/digest `create` in E11000 handling. *(Needs an index drop/rebuild migration — write and test it.)*
3. **C4a** — SW/replay: treat auth redirects as transient (keep queued), exclude `/api/events` from caching, clear `PAGE_CACHE_NAME` on logout, guard `cache.put` with `ok && !redirected`.

**Gate:** manual offline→expire→reconnect test; shared-device logout test; a two-day (mocked-clock) notification-worker test proving daily summaries survive.

### Phase 1 — Client data integrity (critical/high)
4. **C2** — Fix `offlineFetch` PATCH to echo the real id and switch all consuming hooks to **merge** semantics. Add a regression test per hook.
5. **C4b** — Implement tempId → realId rewriting on POST replay (depends on #4).
6. **H1 / H2 / H3 / H6** — Recurrence correctness: return/emit the next occurrence to the originating tab; make completion atomic (`findOneAndUpdate({_id, completedAt:null})`); add the MCP already-completed guard + `maxOrder+1`; call `scheduleNextReminder` for spawned occurrences.

**Gate:** full offline create→edit→reconnect cycle; complete-a-recurring-task in-tab visibility; concurrent-complete dedup.

### Phase 2 — Server correctness & authz hardening (high/medium)
7. **H4 / H5 / M4** — Validate `columnId` against `project.columns` on REST create/update and bulk-move; reject cross-project column mismatches; add orphan-remap to the MCP `update_project`.
8. **H7** — Reset the cached connection promise on rejection in `db.ts`.
9. **H10 / M7 / M8 / M23** — Notification worker: timezone-correct overdue; clear `reminderAt` on non-quiet-hours skips; honor `enableInAppNotifications`; add the overlap `isRunning` guard.
10. **M2 / M17 / M3** — Targeted SSE events on category delete and snooze; exclude archived from stats.
11. **M5 / L4** — Unify recurrence math on `@/lib/date-utils` (delete the MCP duplicate) and anchor monthly recurrence to the original day-of-month.
12. **M21 / M22 / L1** — Consistent error handling: generic 500 bodies unless `error.status` set, E11000→400/409, ObjectId validation→400.

### Phase 3 — Security (high/medium)
13. **H13 / L22** — Fail-fast `AUTH_SECRET` in `docker-compose.yml`; lock down/authenticate `mongo-express`.
14. **H12** — Restrict `users/search` to exact-email matches; stop returning `name`/`image` for non-collaborators; drop the meaningless "owns a project" gate.
15. **H11** — Require email verification before a credentials account is usable, or refuse to auto-link OAuth to an unverified pre-existing account (prompt for explicit linking while authenticated).
16. **M18 / M19 / M20 / L20 / L23** — Token expiry + optional scopes; rate limiting on auth endpoints; stronger password policy; per-user token version for revocation; re-validate SSE session on heartbeat.

### Phase 4 — Client hooks & realtime robustness (high/medium)
17. **H8 / H9 / M9 / M11 / M10** — Wrap `fetchProjects` reconnect handler; make SSE reconnect retry indefinitely at the cap; guard against duplicate EventSources; add `useRefetchOnReconnect` to notes/filter-presets/members/archived; dispatch a queue-changed event.
18. **M1** — Move keyboard-nav side effects out of the state updater (ref-based).
19. **M12 / M13 / M14 / M16 / L5 / L6 / L7** — Search spinner/ordering; `dismissAll` rollback; command-palette sequencing + errors; add missing error toasts; refetch generation tokens; convert raw-`fetch` mutations to `offlineFetch` and check DELETE results.

### Phase 5 — UI dates, UX & accessibility (high→low)
20. **H14** — Fix the three UTC-midnight date-write sites (card popover, bulk bar, calendar drag droppable id).
21. **H15 / H16** — Clear the `taskId` query param after first open; don't overwrite an in-progress (focused/dirty) edit on SSE update.
22. **H17 / M15 / L25** — Add confirmation to Bulk Delete and list-item delete; guard column deletion against archived-only columns.
23. **L27–L33** — Accessibility & polish: dark-mode chip tokens, keyboard-openable overview rows, missing aria-labels, sidebar/card truncation, drop announcements, `⌘K` binding + real search command, calendar project selector, locale-correct labels.

### Cross-cutting
- Follow the mandatory **TDD** workflow (Red → Green → Refactor) for each fix; several current tests assert buggy behaviour or mask bugs with unrealistic fixtures (H6, and the C3-adjacent worker tests) — fix those tests as part of the change.
- Run `pnpm test` (with DB access), `pnpm lint`, and `pnpm build` before each phase merges.
- After each feature, run the **code-simplifier agent** per `CLAUDE.md`.
- Keep `CLAUDE.md` and `.github/copilot-instructions.md` in sync if any convention changes (e.g. a new `reminderSource` field, offline-merge semantics).
