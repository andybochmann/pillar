# Google Calendar Sync

One-way sync from Pillar to Google Calendar. Tasks with due dates appear as all-day events.

## How It Works

1. User connects Google Calendar in **Settings > Google Calendar**
2. A separate OAuth consent flow requests `calendar.events` scope (independent of login)
3. Once connected, toggle enables/disables sync
4. Tasks with due dates are synced as all-day events
5. Completing or deleting a task removes the calendar event

## Sync Triggers

| Action | Calendar Effect |
|---|---|
| Create task with due date | Create all-day event |
| Update task title or due date | Update event |
| Remove due date | Delete event |
| Complete task | Delete event |
| Delete task | Delete event |
| Enable sync (initial) | Bulk sync all incomplete tasks with future due dates |

All sync operations are fire-and-forget — calendar failures never block task mutations.

## Architecture

### OAuth Flow (separate from login)

```
User clicks "Connect Google Calendar"
  → GET /api/calendar/auth (generates CSRF state, redirects to Google)
  → Google consent screen (calendar.events scope, offline access)
  → GET /api/calendar/callback (exchanges code for tokens, stores on Account)
  → Redirect to /settings?calendar=connected
```

The calendar OAuth is completely separate from the login OAuth. This means:
- Login stays frictionless (no calendar scope at login time)
- Users who signed up with email can still connect Google Calendar
- Calendar tokens are stored on the `Account` model alongside login tokens

### Token Management

- Tokens stored on `Account` model: `access_token`, `refresh_token`, `expires_at`, `scope`
- `getValidAccessToken()` auto-refreshes expired tokens via Google's token endpoint
- If refresh fails, `syncErrors` counter increments on `CalendarSync`
- After 5 consecutive errors, sync auto-disables (user sees warning in settings)

### Sync Preferences

The `CalendarSync` model tracks per-user preferences:
- `enabled` — whether sync is active
- `calendarId` — which Google Calendar to use (default: "primary")
- `syncErrors` / `lastSyncError` — error tracking for auto-disable
- `lastSyncAt` — timestamp of last successful sync

### Google API Client

`src/lib/google-calendar.ts` uses raw `fetch()` against the Google Calendar API v3 (no `googleapis` package). Three endpoints:
- `POST /calendars/{id}/events` — create event
- `PUT /calendars/{id}/events/{eventId}` — update event
- `DELETE /calendars/{id}/events/{eventId}` — delete event

### Task ↔ Event Mapping

Each task stores `googleCalendarEventId` (sparse index). Events are all-day with:
- `summary` = task title
- `description` = task description
- `start.date` / `end.date` = due date (end = due date + 1 day, per Google's exclusive end date convention)

## Key Files

| File | Purpose |
|---|---|
| `src/models/calendar-sync.ts` | CalendarSync model |
| `src/lib/google-calendar.ts` | API client + sync logic |
| `src/app/api/calendar/auth/route.ts` | OAuth initiation |
| `src/app/api/calendar/callback/route.ts` | OAuth callback |
| `src/app/api/settings/calendar/route.ts` | Settings API (GET/PATCH/DELETE) |
| `src/hooks/use-calendar-sync.ts` | Client-side hook |
| `src/components/settings/calendar-sync-card.tsx` | Settings UI card |

## GCP Setup

In the Google Cloud project used for OAuth login:
1. Enable the **Google Calendar API**
2. Add `{AUTH_URL}/api/calendar/callback` as an authorized redirect URI
3. No new env vars needed — reuses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`

## Error Handling

- **Token expired**: Auto-refreshed transparently
- **Token revoked**: Errors increment; after 5 failures, sync auto-disables
- **Event not found (404)**: `googleCalendarEventId` cleared, new event created on next sync
- **Rate limit (429) / server error (5xx)**: Logged and skipped; natural retry on next mutation
- **Offline**: Offline queue replays mutations server-side, which triggers sync

## Multi-User / Shared Projects

Calendar sync is personal. When a user modifies a task in a shared project, only that user's calendar is updated. Other project members' calendars are unaffected (they manage their own sync settings).
