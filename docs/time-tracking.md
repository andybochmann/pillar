# Time Tracking

## Overview

Pillar supports per-task time tracking through embedded time sessions on the Task model. Users can start and stop timers on individual tasks, and the system enforces a single active session per user across all tasks by auto-stopping any running timer when a new one starts.

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

- **`"start"`** — Creates a new time session on the specified task. Before creating, the API auto-stops any active session for that user across ALL tasks (not just the current one). This enforces a single running timer per user.
- **`"stop"`** — Sets `endedAt` on the user's active session for this task.

### `DELETE /api/tasks/[id]/time-sessions/[sessionId]`

Removes a specific time session from the task's `timeSessions` array.

## Auto-Stop Behavior

When a user starts a timer on Task B while Task A has an active session:

1. The API finds all tasks with an active session for that user (`endedAt` is null, `userId` matches).
2. It sets `endedAt = now` on every active session found.
3. It then creates the new session on Task B.

This guarantees at most one active timer per user at any given time.

## Client Hook

`src/hooks/use-time-tracking.ts` exposes:

- **`startTracking(taskId)`** — POST with `action: "start"`
- **`stopTracking(taskId)`** — POST with `action: "stop"`
- **`deleteSession(taskId, sessionId)`** — DELETE a specific session

All mutations use `offlineFetch()` for offline support.

## UI

`src/components/tasks/time-sessions-list.tsx` renders the list of time sessions for a task. It displays each session's duration (formatted via `src/lib/time-format.ts`), with an expandable view for details. Active sessions show a running timer.
