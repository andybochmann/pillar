# Time Tracking

## Overview

Pillar supports per-task time tracking through embedded time sessions on the Task model. Users can start and stop timers on individual tasks. Multiple tasks can be tracked simultaneously — there is no single-timer restriction.

## Key Files

| Purpose | File |
|---|---|
| Time sessions API (start/stop) | `src/app/api/tasks/[id]/time-sessions/route.ts` |
| Time session API (delete) | `src/app/api/tasks/[id]/time-sessions/[sessionId]/route.ts` |
| Time tracking hook | `src/hooks/use-time-tracking.ts` |
| Sessions list UI | `src/components/tasks/time-sessions-list.tsx` |
| Duration format utility | `src/lib/time-format.ts` |

## Data Model

Time sessions are embedded directly in the Task document as an array:

```
Task.timeSessions: ITimeSession[]
```

Each `ITimeSession` contains:

| Field | Type | Description |
|---|---|---|
| `startedAt` | `Date` | When the session was started |
| `endedAt` | `Date?` | When the session was stopped (null if active) |
| `userId` | `ObjectId` | The user who owns this session |

A session with a `startedAt` but no `endedAt` is considered active (timer running).

## API

### `POST /api/tasks/[id]/time-sessions`

Accepts a JSON body with `action`:

- **`"start"`** — Creates a new time session on the specified task. Multiple tasks can be tracked concurrently.
- **`"stop"`** — Sets `endedAt` on the user's active session for this task.

### `DELETE /api/tasks/[id]/time-sessions/[sessionId]`

Removes a specific time session from the task's `timeSessions` array.

## Concurrent Timers

Multiple tasks can be tracked simultaneously. Starting a timer on Task B while Task A is already running does not stop Task A. Each task maintains its own independent active session. Users can stop individual timers independently via the Stop button on each task card.

## Client Hook

`src/hooks/use-time-tracking.ts` exposes:

- **`startTracking(taskId)`** — POST with `action: "start"`
- **`stopTracking(taskId)`** — POST with `action: "stop"`
- **`deleteSession(taskId, sessionId)`** — DELETE a specific session

All mutations use `offlineFetch()` for offline support.

## UI

`src/components/tasks/time-sessions-list.tsx` renders the list of time sessions for a task. It displays each session's duration (formatted via `src/lib/time-format.ts`), with an expandable view for details. Active sessions show a running timer.
