# Phase 7 — PWA & Offline Support

## Goal

Make Pillar installable as a Progressive Web App with offline support for viewing and queuing mutations.

## Prerequisites

- Phase 6 complete (polish, error handling, mobile layout)

## Tasks

### 7.1 Web App Manifest

- Create `public/manifest.json` with: app name, short name, description, icons (192x192, 512x512), theme color, background color, display: standalone, start_url: "/"
- Generate app icons in multiple sizes
- Link manifest in root layout `<head>`
- Add `<meta name="theme-color">` and Apple-specific meta tags

### 7.2 Service Worker

- Register service worker in `src/app/layout.tsx` or via `instrumentation-client.ts`
- Cache strategy:
  - **Static assets** (JS, CSS, fonts, images): Cache-first with background revalidation
  - **API reads** (GET): Network-first with cache fallback (stale data when offline)
  - **HTML pages**: Network-first with offline fallback page
- Precache critical assets during install event
- Clean old caches on activate event

### 7.3 Offline Queue

- Detect offline status via `navigator.onLine` + `online`/`offline` events
- Store failed mutations (POST, PATCH, DELETE) in IndexedDB queue
- Queue schema: `{ id, method, url, body, timestamp }`
- Show offline indicator banner in the UI
- Optimistic UI: apply mutations locally even when offline

### 7.4 Background Sync

- On `online` event: replay queued mutations in order
- Conflict resolution: last-write-wins with timestamp comparison
- Retry with exponential backoff on failure
- Toast notification: "X changes synced" on successful replay
- Clear queue after successful sync

### 7.5 Install Prompt

- Listen for `beforeinstallprompt` event
- Show install banner/button for eligible users
- Track install status, hide prompt after install
- Custom install UI integrated into settings page

### 7.6 Offline Fallback Page

- `public/offline.html` — simple page shown when navigating offline to an uncached route
- Styled consistently with the app
- "You're offline" message with retry button

### 7.7 Tests

- **E2E tests**: Service worker registration, offline mode detection, queue mutations while offline, sync on reconnect
- **Unit tests**: Offline queue IndexedDB operations, sync logic
- Network throttling tests in Playwright (simulate offline/slow connections)

## Files to Create/Modify

```
public/manifest.json                         # NEW
public/sw.js                                 # NEW — service worker
public/offline.html                          # NEW — offline fallback
public/icons/                                # NEW — app icons (multiple sizes)
src/app/layout.tsx                           # MODIFY — manifest link, SW registration
src/hooks/use-online-status.ts               # NEW
src/hooks/use-offline-queue.ts               # NEW
src/lib/offline-queue.ts                     # NEW — IndexedDB queue operations
src/lib/sync.ts                              # NEW — background sync logic
src/components/layout/offline-banner.tsx      # NEW
src/components/layout/install-prompt.tsx      # NEW
src/app/(dashboard)/layout.tsx               # MODIFY — offline banner
```

## Acceptance Criteria

- [ ] App is installable as PWA on Chrome, Edge, Safari, and mobile browsers
- [ ] Static assets are cached and served offline
- [ ] API data is cached and viewable offline (stale)
- [ ] Mutations made offline are queued in IndexedDB
- [ ] Queued mutations sync automatically when back online
- [ ] Offline indicator banner shows when disconnected
- [ ] Install prompt appears for eligible users
- [ ] All offline flows have E2E tests
