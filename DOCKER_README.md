# Pillar

Kanban-based task management app with drag-and-drop, recurring tasks, calendar views, real-time sync, project sharing, and offline PWA support.

Built with Next.js, TypeScript, MongoDB, and Auth.js.

## Features

- Drag-and-drop Kanban board with configurable columns
- Board and list view modes
- Recurring tasks (daily, weekly, monthly, yearly)
- Calendar views (month, week, agenda)
- Project sharing with role-based access (owner/editor)
- Task assignment within shared projects
- Real-time multi-device sync via SSE
- Offline PWA mode with automatic sync on reconnect
- Dark/light theme support
- Category and label organization

## Supported Tags

- `latest` — latest stable release
- `x.y.z` — specific version (e.g., `1.0.0`)
- `x.y` — latest patch for a minor version (e.g., `1.0`)
- `x` — latest minor/patch for a major version (e.g., `1`)

## Supported Architectures

- `linux/amd64`
- `linux/arm64`

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -e MONGODB_URI=mongodb://your-mongo-host:27017/pillar \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  -e AUTH_URL=http://localhost:3000 \
  -e AUTH_TRUST_HOST=true \
  --name pillar \
  andybochmann/pillar:latest
```

## Docker Compose (Recommended)

Create a `docker-compose.yml`:

```yaml
services:
  app:
    image: andybochmann/pillar:latest
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/pillar
      - AUTH_SECRET=<run: openssl rand -base64 32>
      - AUTH_URL=http://localhost:3000
      - AUTH_TRUST_HOST=true
    depends_on:
      mongo:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh --quiet
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

volumes:
  mongo-data:
```

Then run:

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and create an account.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `AUTH_SECRET` | Yes | Secret for signing JWT sessions. Generate with `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Public URL of the app (e.g., `https://pillar.example.com`) |
| `AUTH_TRUST_HOST` | No | Set to `true` when behind a reverse proxy (default: `false`) |

## Health Check

The container includes a built-in health check that polls `http://localhost:3000` every 30 seconds. Compatible with Docker Compose, Portainer, and container orchestrators.

## Source Code

[github.com/andybochmann/pillar](https://github.com/andybochmann/pillar)
