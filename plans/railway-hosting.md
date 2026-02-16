# Railway Hosting Plan

> **Decision date**: 2026-02-15
> **Status**: Planned
> **Chosen platform**: Railway (~$5-7/mo)

## Why Railway

Pillar's architecture relies on a **long-running Node.js process** — in-memory EventEmitter for SSE real-time sync and a background `setInterval` for notification processing. This makes serverless platforms (Vercel, Netlify) a poor fit without major refactoring. Railway runs persistent Docker containers, so the existing codebase deploys **with zero code changes**.

### Why Not Serverless (Vercel)?

| Pillar Feature | Problem on Vercel |
|---|---|
| SSE real-time sync (`event-bus.ts`) | In-memory EventEmitter can't work across serverless instances; connections timeout at 60s |
| Background notification worker | `setInterval` every 2 minutes can't run in serverless; free cron is daily only |
| MongoDB (standalone) | Each function opens its own connection pool; Atlas M0 caps at 100 connections |

Vercel would require ~1-2 days of refactoring (SSE to polling, worker to cron) and degrade real-time from instant push to 30-second polling.

## Railway Overview

- **What it is**: Managed PaaS that runs persistent Docker containers (not serverless)
- **Pricing**: Hobby plan $5/month (includes $5/month credit); pay for actual CPU/RAM/storage usage
- **Typical cost**: Small Next.js + MongoDB app runs **$5-7/month total**
- **Setup time**: ~15 minutes (connect GitHub, deploy)

### What Works Unchanged

- Full SSE real-time sync (persistent process, in-memory EventEmitter)
- Background notification worker (`setInterval` every 2 minutes)
- MongoDB as a Railway service (or external Atlas)
- Auth.js v5 with JWT sessions
- PWA / Service Worker / Offline queue
- Web Push notifications
- MCP server (stateless per-request)
- AI subtask generation
- DnD Kanban (client-side)

## Setup Steps

### 1. Create Railway Account
- Sign up at [railway.com](https://railway.com)
- Select Hobby plan ($5/month)

### 2. Add MongoDB Service
- In the Railway dashboard, add a new service: **MongoDB**
- Railway provisions a managed MongoDB instance
- Copy the connection string (auto-injected as `MONGODB_URI` env var)
- **Alternative**: Use MongoDB Atlas M0 (free, 512MB) for managed backups

### 3. Deploy the App
- Connect your GitHub repository
- Railway auto-detects Next.js and builds from the existing `Dockerfile`
- No Dockerfile or YAML changes required (auto-config via Nixpacks/Railpacks also available)

### 4. Set Environment Variables
In Railway dashboard, set:
```
MONGODB_URI=<railway-provided or atlas connection string>
AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_URL=https://<your-railway-domain>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<existing VAPID public key>
VAPID_PRIVATE_KEY=<existing VAPID private key>
ANTHROPIC_API_KEY=<for AI subtask generation>
```

### 5. Custom Domain (Optional)
- Add a custom domain in Railway settings
- Point DNS CNAME to the Railway-provided domain
- SSL is automatic

### 6. Data Migration (If Needed)
```bash
# Export from current Docker MongoDB
mongodump --uri="mongodb://localhost:27017/pillar" --out=./backup

# Import to Railway MongoDB
mongorestore --uri="<railway-mongodb-uri>" ./backup
```

## Alternatives Considered

| Platform | Monthly Cost | Code Changes | Setup | Trade-offs |
|---|---|---|---|---|
| **Railway** | ~$5-7 | None | ~15min | Slightly more expensive than self-hosted |
| Hetzner + Coolify | ~$4 (EUR 3.49) | None | ~1hr | Self-managed VPS, Coolify UI can be clunky |
| Oracle Cloud Free | $0 | None | ~2-3hr | ARM architecture, capacity errors, more manual setup |
| Fly.io | ~$2-5 | None | ~30min | CLI-oriented, need persistent volume for MongoDB |
| Render | ~$7 | None | ~30min | Free tier spins down (breaks SSE) |
| Vercel + Atlas | $0 | Major refactor | ~1-2 days | Degrades real-time to polling, daily cron only |

### Decision Rationale

| Priority | Best Pick |
|---|---|
| Cheapest possible | Oracle Cloud Always Free ($0, more setup) |
| Best cost + ease balance | Hetzner + Coolify (~$4/mo, nice dashboard) |
| **Fastest to set up** | **Railway (~$5-7/mo, 15-min deploy)** |

Railway was chosen for the **fastest path to production** with zero code changes and minimal ops overhead. The ~$5-7/month cost is acceptable for a production app with full real-time sync, background jobs, and managed infrastructure.
