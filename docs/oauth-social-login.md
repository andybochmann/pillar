# OAuth Social Login

Pillar supports Google OAuth sign-in alongside the existing email/password authentication. The Google provider is **optional** — when unconfigured, login/register pages render normally with no social buttons.

## Architecture

- **No database adapter** — Auth.js uses JWT sessions with manual user management in callbacks
- **Account model** (`src/models/account.ts`) links OAuth provider identities to User records
- **Account linking by email** — when an OAuth user's email matches an existing User, the accounts are automatically linked
- **`handleOAuthSignIn`** (`src/lib/oauth-linking.ts`) contains the linking logic, extracted for testability
- **Conditional providers** — Google only added to Auth.js when its env vars are set

## Data Model

### Account

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Ref to User, indexed |
| `provider` | String | `"credentials"`, `"google"` |
| `providerAccountId` | String | Provider-specific user ID |

**Indexes:**
- `{ provider, providerAccountId }` — unique (one link per OAuth identity)
- `{ userId, provider }` — unique (one provider type per user)

### User changes

- `passwordHash` is now **optional** — OAuth-only users have no password

## Sign-in Flow

1. **Credentials** — existing flow, unchanged (rejects users without `passwordHash`)
2. **OAuth** (`signIn` callback):
   - Check for existing Account link → reuse user
   - Look up User by email → create Account link
   - No existing user → create User + Account
   - Google: reject unverified emails (`email_verified: false`)
   - Update profile image if missing

## Session Changes

- `session.user.hasPassword: boolean` — indicates whether user has a password set
- Set via `jwt` callback from DB lookup, refreshed on `trigger: "update"`

## Settings Page

- **Connected Accounts card** — shows linked providers, "Connect" button for unlinked OAuth
- **Password card** — conditional:
  - Has password: "Change Password" (requires current password)
  - No password: "Set Password" (new password only, creates credentials Account)

## Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://your-domain/api/auth/callback/google`
4. Set environment variables:

```env
AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-client-secret
```

### Docker

OAuth env vars are passed through `docker-compose.yml`. Set them in your `.env` file or environment.

## Migration

For existing databases, run the migration to create Account records for password users:

```bash
npx tsx scripts/migrate-accounts.ts
```

This is idempotent and safe to run multiple times.

## Key Files

| File | Purpose |
|------|---------|
| `src/models/account.ts` | Account model |
| `src/lib/oauth-linking.ts` | OAuth sign-in + account linking logic |
| `src/lib/auth.ts` | Auth.js config with providers + callbacks |
| `src/types/next-auth.d.ts` | Session/JWT type augmentations |
| `src/components/auth/social-login-buttons.tsx` | OAuth sign-in buttons |
| `src/components/settings/connected-accounts-card.tsx` | Linked providers UI |
| `scripts/migrate-accounts.ts` | Migration for existing users |
