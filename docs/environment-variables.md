# Environment Variables

## Overview

Pillar's configuration is managed entirely through environment variables. The application requires core variables for database and authentication, with optional variables for enabling AI-powered features and controlling user access.

All environment variables should be defined in a `.env.local` file in the project root for local development, or passed directly to the container when deploying with Docker.

## Key Files

| Purpose | File |
|---|---|
| Environment variable validation | `src/lib/db.ts` (MongoDB), `src/lib/ai.ts` (AI features) |
| Example configuration | `.env.example` |
| Auth configuration (uses env vars) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Docker deployment guide | `DOCKER_README.md` |

## Required Variables

These variables **must** be set for the application to function.

### `MONGODB_URI`

MongoDB connection string for the application database.

- **Type**: String (URI)
- **Required**: Yes
- **Default**: None
- **Valid Values**: Any valid MongoDB connection string
- **Examples**:
  - Local development: `mongodb://localhost:27017/pillar`
  - Docker Compose: `mongodb://mongo:27017/pillar`
  - MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/pillar`

**Notes**:
- Pillar uses a standalone MongoDB instance (no replica set required)
- Change Streams and transactions are not used
- The database name (`pillar`) can be customized in the connection string

### `AUTH_SECRET`

Secret key used by Auth.js v5 to sign and encrypt JWT session tokens.

- **Type**: String (base64)
- **Required**: Yes
- **Default**: None
- **Valid Values**: Any string of at least 32 characters (base64 recommended)
- **Examples**:
  - Generate: `openssl rand -base64 32`
  - Result: `3Fh8K9x2Nq7Lp4Yw6Vb1Zm5Rt8Uc3Sd`

**Security Notes**:
- **NEVER commit this value to version control**
- Use a different secret for each environment (dev, staging, production)
- Changing this value will invalidate all existing user sessions
- Must be at least 32 characters long

### `AUTH_URL`

Public URL where the application is accessible. Used by Auth.js for OAuth callbacks, redirects, and URL generation.

- **Type**: String (URL)
- **Required**: Yes
- **Default**: None
- **Valid Values**: Any valid HTTP/HTTPS URL
- **Examples**:
  - Local development: `http://localhost:3000`
  - Production: `https://pillar.example.com`
  - Staging: `https://staging.pillar.example.com`

**Notes**:
- Must match the URL users access in their browser
- Include the protocol (`http://` or `https://`)
- Do **not** include a trailing slash
- Required for proper session cookie handling

## Optional Variables

These variables enable additional features or customize behavior.

### `AUTH_TRUST_HOST`

**Note**: In the current implementation, `trustHost` is hardcoded to `true` in the Auth.js configuration (`src/lib/auth.config.ts`). This means the application always trusts the `X-Forwarded-Host` header from reverse proxies.

- **Type**: Boolean (`true` or `false`)
- **Required**: No
- **Default**: Always `true` (hardcoded)
- **Configurable**: No (hardcoded in config)

**Why Always Enabled**:
- Pillar is designed primarily for Docker deployment behind reverse proxies (Nginx, Traefik, etc.)
- Auth.js v5 handles host detection more intelligently than v4, making this less risky
- Simplifies configuration for the primary deployment scenario

**Deployment Scenarios**:
- ✓ Production (behind reverse proxy): Works correctly
- ✓ Docker Compose (behind reverse proxy): Works correctly
- ✓ Local development (direct access): Works correctly (trust host not needed but harmless)

**If you need to disable `trustHost`**: Modify `src/lib/auth.config.ts` and change `trustHost: true` to `trustHost: false`, then rebuild the application.

### `AI_API_KEY`

API key for the AI provider (OpenAI or Google). Enables AI-powered subtask generation.

- **Type**: String (API key)
- **Required**: No (AI features disabled if not set)
- **Default**: None (AI disabled)
- **Valid Values**: Valid API key from your chosen provider
- **Examples**:
  - OpenAI: `sk-proj-...` (starts with `sk-`)
  - Google: `AIza...` (Gemini API key)

**Feature Impact**:
- If **not set**: AI features are completely disabled, no UI elements shown
- If **set**: AI subtask generation becomes available to users (subject to `AI_ALLOWED_EMAILS`)

**Security Notes**:
- **NEVER commit API keys to version control**
- Store securely using environment variables or secrets management
- Monitor API usage to avoid unexpected costs
- Rotate keys periodically

**Related Variables**: `AI_PROVIDER`, `AI_MODEL`, `AI_ALLOWED_EMAILS`

### `AI_PROVIDER`

The AI provider to use for subtask generation.

- **Type**: String (enum)
- **Required**: No (only needed if `AI_API_KEY` is set)
- **Default**: `openai`
- **Valid Values**: `openai`, `google`
- **Examples**:
  - OpenAI (GPT models): `openai`
  - Google (Gemini models): `google`

**Provider Details**:

| Provider | Default Model | SDK |
|---|---|---|
| `openai` | `gpt-4.1-mini` | `@ai-sdk/openai` |
| `google` | `gemini-2.0-flash` | `@ai-sdk/google` |

**Notes**:
- Default models are defined in `src/lib/ai.ts` (`DEFAULT_MODELS`)
- Override the default model using `AI_MODEL`
- Ignored if `AI_API_KEY` is not set

### `AI_MODEL`

The specific AI model to use for subtask generation.

- **Type**: String (model ID)
- **Required**: No (defaults to provider's default)
- **Default**: Provider-specific (see table above)
- **Valid Values**: Any model ID supported by the chosen provider
- **Examples**:
  - OpenAI: `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`
  - Google: `gemini-2.0-flash`, `gemini-pro`, `gemini-1.5-flash`

**Notes**:
- Overrides the default model for your chosen provider
- Different models have different costs, speed, and quality trade-offs
- Ensure the model ID is valid for your provider
- Ignored if `AI_API_KEY` is not set

### `AI_ALLOWED_EMAILS`

Comma-separated list of email addresses allowed to use AI features. Used for access control and cost management.

- **Type**: String (comma-separated emails)
- **Required**: No
- **Default**: None (all users allowed if AI is enabled)
- **Valid Values**: Comma-separated list of valid email addresses
- **Examples**:
  - Single user: `admin@example.com`
  - Multiple users: `user1@example.com,user2@example.com,admin@example.com`

**Access Control Logic**:
- If **not set**: All authenticated users can use AI features (when `AI_API_KEY` is configured)
- If **set**: Only listed email addresses can access AI features
- Email matching is case-insensitive
- Whitespace around emails is automatically trimmed

**Use Cases**:
- Limit AI usage to specific users/admins to control costs
- Roll out AI features gradually to select beta users
- Restrict access in shared/multi-tenant environments

**Implementation**: See `isAIAllowedForUser()` in `src/lib/ai.ts`

## Configuration Examples

### Local Development

Create `.env.local`:

```bash
# MongoDB (local instance)
MONGODB_URI=mongodb://localhost:27017/pillar

# Auth.js (generate secret with: openssl rand -base64 32)
AUTH_SECRET=your-generated-secret-here
AUTH_URL=http://localhost:3000

# AI features (optional)
AI_API_KEY=sk-proj-your-openai-key
AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
AI_ALLOWED_EMAILS=dev@example.com
```

### Docker Compose

In `docker-compose.yml`:

```yaml
services:
  app:
    image: andybochmann/pillar:latest
    environment:
      # MongoDB (Docker service)
      - MONGODB_URI=mongodb://mongo:27017/pillar

      # Auth.js (generate: openssl rand -base64 32)
      - AUTH_SECRET=<your-generated-secret>
      - AUTH_URL=http://localhost:3000
      # Note: trustHost is hardcoded to true (see AUTH_TRUST_HOST section)

      # AI features (optional)
      - AI_API_KEY=${AI_API_KEY}
      - AI_PROVIDER=openai
      - AI_MODEL=gpt-4o-mini
```

### Production (Docker)

Using environment variables file:

```bash
# .env.production (not committed to git)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pillar
AUTH_SECRET=<strong-random-secret-at-least-32-chars>
AUTH_URL=https://pillar.example.com
# Note: trustHost is hardcoded to true (not configurable via env var)

AI_API_KEY=<your-api-key>
AI_PROVIDER=google
AI_MODEL=gemini-2.0-flash
AI_ALLOWED_EMAILS=admin@example.com,team@example.com
```

Then run:

```bash
docker run -d \
  --env-file .env.production \
  -p 3000:3000 \
  andybochmann/pillar:latest
```

### Production (Vercel/Platform-as-a-Service)

Add environment variables in your platform's dashboard:

| Variable | Value |
|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/pillar` |
| `AUTH_SECRET` | `<generated-secret>` |
| `AUTH_URL` | `https://pillar.vercel.app` |
| `AI_API_KEY` | `<api-key>` (optional) |
| `AI_PROVIDER` | `openai` (optional) |

**Note**: `AUTH_TRUST_HOST` is hardcoded to `true` in the application and cannot be configured via environment variable. See the [AUTH_TRUST_HOST section](#auth_trust_host) for details.

## Validation and Error Handling

The application validates environment variables at runtime:

### MongoDB (`MONGODB_URI`)

**Validation**: `src/lib/db.ts` → `getMongoURI()`
- **Error if missing**: `"MONGODB_URI environment variable is not defined"`
- **When checked**: On first database connection attempt
- **Impact**: Application cannot start without a valid MongoDB connection

### Auth.js Variables

**Validation**: Auth.js v5 automatic validation
- **Error if `AUTH_SECRET` missing**: Auth.js throws configuration error
- **Error if `AUTH_URL` invalid**: Session cookies may not work correctly
- **When checked**: On first authentication request
- **Impact**: Users cannot log in without proper auth configuration

### AI Variables

**Validation**: `src/lib/ai.ts` → `isAIEnabled()`, `getAIModel()`
- **`AI_API_KEY` missing**: AI features silently disabled (no error)
- **`AI_API_KEY` invalid**: Error thrown when user attempts to use AI features
- **When checked**: On AI feature access (lazy validation)
- **Impact**: AI features gracefully degrade if not configured

**Check AI Status**: `GET /api/ai/status` returns `{ enabled: boolean }`

## Environment Variable Precedence

Next.js loads environment variables in this order (later sources override earlier ones):

1. `.env` — Shared defaults (committed to git)
2. `.env.local` — Local overrides (ignored by git)
3. `.env.production` — Production defaults (committed to git)
4. `.env.production.local` — Production overrides (ignored by git)
5. System environment variables — Highest priority

**Recommendation**: Use `.env.local` for local development, system environment variables for production.

## Security Best Practices

1. **Never commit secrets** to version control
   - Add `.env.local`, `.env.production.local` to `.gitignore`
   - Commit `.env.example` with placeholder values only

2. **Use strong secrets**
   - Generate `AUTH_SECRET` with `openssl rand -base64 32`
   - Minimum 32 characters for all secrets

3. **Rotate secrets periodically**
   - Change `AUTH_SECRET` → invalidates all sessions (users must re-login)
   - Change `AI_API_KEY` → no impact on users

4. **Use different secrets per environment**
   - Dev, staging, production should each have unique `AUTH_SECRET`

5. **Secure API keys**
   - Store `AI_API_KEY` in a secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Monitor API usage for anomalies
   - Set usage limits with your AI provider

6. **Principle of least privilege**
   - Use `AI_ALLOWED_EMAILS` to restrict expensive AI features
   - Use read-only MongoDB credentials when possible

## Troubleshooting

### Database Connection Errors

**Symptom**: `"MONGODB_URI environment variable is not defined"`
- **Cause**: `MONGODB_URI` not set or `.env.local` not loaded
- **Fix**: Verify `.env.local` exists and contains `MONGODB_URI`

**Symptom**: `MongoServerError: Authentication failed`
- **Cause**: Invalid credentials in `MONGODB_URI`
- **Fix**: Check username/password in connection string

### Authentication Issues

**Symptom**: `"AUTH_SECRET is not set"`
- **Cause**: Auth.js v5 cannot find `AUTH_SECRET`
- **Fix**: Set `AUTH_SECRET` in environment

**Symptom**: Infinite redirect loop on login
- **Cause**: Incorrect `AUTH_URL` configuration
- **Fix**: Ensure `AUTH_URL` matches the exact URL users access in their browser (including protocol and port)

### AI Features Not Working

**Symptom**: AI button not visible in UI
- **Cause**: `AI_API_KEY` not set → AI disabled
- **Fix**: Set `AI_API_KEY` to enable AI features

**Symptom**: "AI features are disabled" error
- **Cause**: User email not in `AI_ALLOWED_EMAILS`
- **Fix**: Add user email to `AI_ALLOWED_EMAILS` or remove variable to allow all users

**Symptom**: "Invalid API key" error
- **Cause**: `AI_API_KEY` is incorrect or expired
- **Fix**: Verify API key with your provider, generate a new key if needed

## Related Documentation

- [AI Features](./ai-features.md) — Detailed AI feature implementation
- [Offline/PWA](./offline-pwa.md) — Offline mode and service worker configuration
- [Project Sharing](./project-sharing.md) — Multi-user collaboration
- [Docker README](../DOCKER_README.md) — Docker deployment guide
