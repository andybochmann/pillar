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
| Online status hook | `src/hooks/use-online-status.ts` |
| Web app manifest | `public/manifest.json` |

## Architecture

### Service Worker (`public/sw.js`)

A vanilla service worker (no Workbox) that:

- Caches the app shell (HTML, CSS, JS, static assets) on install
- Serves cached resources when offline, falling back to an offline page
- Uses a cache-first strategy for static assets and network-first for API calls

### Offline Queue (`src/lib/offline-queue.ts`)

An IndexedDB-based queue (using the `idb` library) that stores failed mutation requests. Each queued entry contains:

- The request URL, method, headers, and body
- A timestamp for ordering

When a mutation fails due to a network error, the request is serialized and added to the queue for later replay.

### Offline Fetch (`src/lib/offline-fetch.ts`)

A wrapper around `fetch()` used for all mutation requests (POST, PATCH, PUT, DELETE) in hooks. It:

1. Attempts the fetch normally
2. On network failure, queues the request in IndexedDB via the offline queue
3. Injects the `X-Session-Id` header on every request for SSE echo suppression
4. Returns a synthetic response so the caller can proceed with optimistic updates

All hooks use `offlineFetch()` instead of raw `fetch()` for mutations. GET requests use plain `fetch()`.

### Sync Engine (`src/lib/sync.ts`)

Processes the offline queue when connectivity is restored:

1. Reads all queued mutations from IndexedDB, ordered by timestamp
2. Replays each request sequentially against the API
3. Removes successfully processed entries from the queue
4. Injects `X-Session-Id` on replayed requests to maintain echo suppression

Sync is triggered automatically on reconnect via the online status hook.

### Online Status Hook (`src/hooks/use-online-status.ts`)

Tracks the browser's online/offline state via `navigator.onLine` and the `online`/`offline` window events. Components use this to show connectivity indicators and trigger sync on reconnect.

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
   |         |
   v         v
 Response  Optimistic update
             |
        (reconnect)
             |
             v
        sync.ts replays
        queued mutations
```
