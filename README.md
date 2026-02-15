# Pillar

A Kanban-based task management app built with Next.js, TypeScript, and MongoDB. Supports multiple users, configurable boards, recurring tasks, calendar views, and offline mode.

## Features

- **Kanban boards** with drag-and-drop (powered by @dnd-kit)
- **Configurable columns** per project
- **Recurring tasks** (daily, weekly, monthly, yearly)
- **Calendar view** for deadline tracking
- **Project categories** for organizing work
- **Task labels and priorities** with filtering
- **Offline PWA** with background sync via IndexedDB
- **Multi-user** with credentials-based authentication
- **Dark mode** support

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB via Mongoose
- **Auth**: Auth.js v5 (next-auth)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Testing**: Vitest + React Testing Library + Playwright

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [MongoDB](https://www.mongodb.com/) 7+ (local or remote)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/andy-bochmann/pillar.git
cd pillar

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env and set your MONGODB_URI and AUTH_SECRET

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Docker Compose

Run the full stack (app + MongoDB) with Docker:

```bash
docker compose up -d
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Testing

```bash
pnpm test             # Run unit/integration tests
pnpm test:watch       # Tests in watch mode
pnpm test:coverage    # Tests with coverage report
pnpm test:e2e         # Playwright E2E tests (requires running dev server)
```

## Project Structure

```
src/
  app/
    (auth)/            # Login and registration pages
    (dashboard)/       # Main app pages (kanban, calendar, settings)
    api/               # REST API route handlers
  components/
    calendar/          # Calendar view components
    kanban/            # Kanban board, columns, task cards
    tasks/             # Task creation/editing sheets
    ui/                # shadcn/ui primitives
  hooks/               # Custom React hooks for data fetching
  lib/                 # Utilities, auth config, DB connection, offline support
  models/              # Mongoose models (User, Project, Task, Category, Label)
  types/               # Shared TypeScript types
public/
  sw.js                # Service worker for offline support
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the PR process.

## License

[MIT](LICENSE)
