# Offline & PWA Support

## Overview

Pillar is a Progressive Web App with offline mutation support. A service worker caches the app shell for offline access, while an IndexedDB-backed queue captures failed mutations and replays them when connectivity is restored. The `offlineFetch()` wrapper is used throughout the app for all mutation requests.

## Key Files

| Purpose | File |
|---|---|
| Service worker | `public/sw.js` |
| IndexedDB offline queue | `src/lib/offline-queue.ts` |
| Fetch wrapper | `src/lib/offline-fetch.ts` |
| Sync engine | `src/lib/sync.ts` |
| Offline queue hook | `src/hooks/use-offline-queue.ts` |
| Online status hook | `src/hooks/use-online-status.ts` |
| Offline banner | `src/components/layout/offline-banner.tsx` |
| SW registrar | `src/components/layout/sw-registrar.tsx` |
| Background Sync types | `src/types/background-sync.d.ts` |
| Web app manifest | `public/manifest.json` |

## Architecture

### Service Worker (`public/sw.js`)

A vanilla service worker (no Workbox) that:

- Caches the app shell (HTML, CSS, JS, static assets) on install
- Serves cached resources when offline, falling back to an offline page
- Uses a cache-first strategy for static assets and network-first for API calls
- Handles Background Sync events to replay offline mutations even when the app is closed

### SW Cache Warming (`src/components/layout/sw-registrar.tsx`)

On first load, the service worker isn't active yet, so the initial page never gets intercepted and cached. After SW registration, `SwRegistrar` waits for `navigator.serviceWorker.ready` and then fetches the current page URL. The SW intercepts this fetch and caches the HTML response via `networkFirstNavigation`. This ensures the first-visited page is available offline without needing to add auth-gated routes to `PRECACHE_URLS`.

### Offline Queue (`src/lib/offline-queue.ts`)

An IndexedDB-based queue (using the `idb` library) that stores failed mutation requests. Each queued entry contains:

- The request URL, method, headers, and body
- A timestamp for ordering

When a mutation fails due to a network error, the request is serialized and added to the queue for later replay.

### Offline Fetch (`src/lib/offline-fetch.ts`)

A wrapper around `fetch()` used for all mutation requests (POST, PATCH, PUT, DELETE) in hooks. It:

1. Attempts the fetch normally
2. On network failure, queues the request in IndexedDB via the offline queue
3. Registers a Background Sync event so the SW can replay mutations even if the app is closed
4. Injects the `X-Session-Id` header on every request for SSE echo suppression
5. Returns a synthetic response so the caller can proceed with optimistic updates

All hooks use `offlineFetch()` instead of raw `fetch()` for mutations. GET requests use plain `fetch()`.

### Sync Engine (`src/lib/sync.ts`)

Processes the offline queue when connectivity is restored:

1. Reads all queued mutations from IndexedDB, ordered by timestamp
2. Replays each request sequentially against the API
3. Uses exponential backoff for retries (max 3 attempts, base 1s delay)
4. Skips retries on 4xx client errors (permanent failures)
5. Removes successfully processed entries from the queue
6. Injects `X-Session-Id` on replayed requests to maintain echo suppression

### Offline Queue Hook (`src/hooks/use-offline-queue.ts`)

Manages the offline queue lifecycle:

- Tracks pending mutation count from IndexedDB
- Auto-syncs when the browser comes back online
- Provides manual `syncNow()` for user-triggered sync
- Listens for `SYNC_COMPLETE` messages from the service worker (Background Sync completion)
- Shows toast notifications for sync success/failure
- Dispatches `pillar:sync-complete` custom event for app-wide coordination

### Offline Banner (`src/components/layout/offline-banner.tsx`)

Always mounted in the dashboard layout. Uses `useOfflineQueue` (which wires up auto-sync). Shows contextual UI:

- **Offline**: "You're offline" + pending change count
- **Online + syncing**: spinner + "Syncing N changes..."
- **Online + queued items**: pending count + "Sync now" button
- **Online + empty queue**: hidden (returns null)

### Online Status Hook (`src/hooks/use-online-status.ts`)

Tracks the browser's online/offline state via `navigator.onLine` and the `online`/`offline` window events. Components use this to show connectivity indicators and trigger sync on reconnect.

## Background Sync API

The Background Sync API allows the service worker to replay queued mutations even when the app is closed. This provides the best offline experience on supported browsers.

### How It Works

1. When `offlineFetch()` queues a mutation, it also calls `navigator.serviceWorker.ready` then `reg.sync.register("pillar-offline-sync")`
2. The browser fires a `sync` event in the service worker when connectivity is restored, even if the app tab is closed
3. The SW's sync handler opens IndexedDB directly (same DB/store as `offline-queue.ts`), reads all mutations, replays them sequentially with retry logic, and deletes successful entries
4. After replay, the SW posts `{ type: "SYNC_COMPLETE" }` to all open clients so the UI refreshes
5. If any mutations failed, the handler throws — the browser will retry the sync event later

### Fallback Chain

| Priority | Mechanism | Browser Support |
|---|---|---|
| 1 | Background Sync API | Chromium browsers (Chrome, Edge, Opera) |
| 2 | In-app auto-sync on reconnect | All browsers (via `useOfflineQueue` hook) |
| 3 | Manual "Sync now" button | All browsers |

### Double-Sync Safety

If both the SW Background Sync and the in-app auto-sync attempt to replay simultaneously, one of them finds an empty queue and becomes a no-op. The `syncingRef` in `useOfflineQueue` also prevents concurrent in-app syncs.

## Manifest (`public/manifest.json`)

Standard PWA manifest defining the app name, icons, theme color, and display mode for install-to-homescreen support.

## Flow Summary

```
User performs mutation
        |
        v
  offlineFetch()
        |
   +----+----+
   |         |
Online    Offline
   |         |
   v         v
 fetch()   Queue in IndexedDB
   |         + register Background Sync
   v         |
 Response  Optimistic update
             |
        (reconnect)
             |
     +-------+-------+
     |               |
  SW sync         App sync
  (bg, any       (in-app,
   browser)       on reconnect)
     |               |
     v               v
  Replay queue    Replay queue
  via SW fetch    via sync.ts
     |               |
     v               v
  Notify clients  Toast + event
```
