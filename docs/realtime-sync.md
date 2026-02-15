# Real-Time Sync

## Overview

Pillar uses Server-Sent Events (SSE) to push real-time updates to all connected clients. When any user mutates data (tasks, projects, labels, categories, members), the API route emits a sync event through an in-memory EventEmitter bus. Connected clients receive these events and refresh their local state accordingly.

To prevent echo (the originator seeing their own mutation as an incoming event), every mutation includes an `X-Session-Id` header. The SSE endpoint filters out events matching the caller's session.

## Key Files

| Purpose | File |
|---|---|
| SSE endpoint | `src/app/api/events/route.ts` |
| Event bus (in-memory) | `src/lib/event-bus.ts` |
| Client SSE connection | `src/hooks/use-realtime-sync.ts` |
| Entity subscription helper | `src/hooks/use-sync-subscription.ts` |
| Dashboard provider | `src/components/layout/realtime-provider.tsx` |
| Offline fetch (injects header) | `src/lib/offline-fetch.ts` |
| Sync engine (injects header) | `src/lib/sync.ts` |

## Architecture

### Server Side

1. **Event Bus** (`src/lib/event-bus.ts`) — A singleton in-memory `EventEmitter` that emits sync events. Each event carries:
   - `entity`: one of `task`, `project`, `label`, `category`, `member`
   - `action`: the mutation type (e.g., `created`, `updated`, `deleted`)
   - `targetUserIds`: array of user IDs who should receive this event (supports multi-user delivery on shared projects)
   - `sessionId`: the originator's session ID, used for echo suppression

2. **SSE Endpoint** (`src/app/api/events/route.ts`) — Long-lived HTTP connection that streams events to the client. Filters events by:
   - The authenticated user's ID (only delivers events where the user is in `targetUserIds`)
   - The `X-Session-Id` header (skips events originating from the same session)

3. **API Mutation Routes** — All API routes that perform writes (POST, PATCH, PUT, DELETE) call `emitSyncEvent()` after a successful database write. This ensures every mutation is broadcast to relevant users.

### Client Side

1. **`use-realtime-sync`** (`src/hooks/use-realtime-sync.ts`) — Opens an `EventSource` connection to the SSE endpoint. Includes auto-reconnect logic with backoff on connection drops. Dispatches received events as `CustomEvent` instances on `window`.

2. **`use-sync-subscription`** (`src/hooks/use-sync-subscription.ts`) — A convenience hook that listens for `CustomEvent` dispatches on `window` for a specific entity type. Components use this to react to relevant changes (e.g., a task list re-fetches when a `task` event arrives).

3. **`realtime-provider.tsx`** (`src/components/layout/realtime-provider.tsx`) — Mounted in the dashboard layout. Initializes the SSE connection for the authenticated user session.

## Echo Suppression

Both `offlineFetch()` and `sync.ts` inject an `X-Session-Id` header on every mutation request. The SSE endpoint reads this header and excludes the originator's session from event delivery. This prevents a user from receiving a redundant update for their own action.

## Multi-User Delivery

For shared projects, `targetUserIds` includes all project members. The event bus and SSE endpoint use this array to ensure every collaborator receives the update, regardless of which user initiated the change.
