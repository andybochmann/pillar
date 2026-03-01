# Pillar

A Kanban-based task management app built with Next.js, TypeScript, and MongoDB. Supports team collaboration, real-time sync, rich notes, time tracking, push notifications, AI-powered subtasks, offline PWA mode, and more.

## Features

### Core

- **Kanban boards** with drag-and-drop (powered by @dnd-kit)
- **Configurable columns** per project
- **Recurring tasks** (daily, weekly, monthly, yearly)
- **Task labels and priorities** with filtering and saved filter presets
- **Task archiving** with bulk operations
- **Inline task editing** directly on Kanban cards
- **Project categories** for organizing work

### Collaboration

- **Project sharing** with role-based access (owner/editor)
- **Real-time sync** across devices and team members via server-sent events

### Productivity

- **Calendar view** (day/week) for deadline tracking
- **Time tracking** with built-in stopwatch and session history
- **AI-powered subtask generation** (OpenAI / Google AI)
- **Rich Markdown notes** at category, project, and task level with auto-save and pinning
- **Push notifications** with action buttons (mark complete / snooze)
- **Global search** across tasks, projects, and categories
- **Command palette** and keyboard shortcuts (including Kanban keyboard navigation)

### Infrastructure

- **Offline PWA** with background sync via IndexedDB
- **Data backup** export and import
- **MCP API** with 27 tools for external integrations
- **Google OAuth + credentials auth** via Auth.js v5
- **Dark mode** support
- **Docker Compose** deployment

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
git clone https://github.com/andybochmann/pillar.git
cd pillar

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env and set your MONGODB_URI and AUTH_SECRET
# See docs/environment-variables.md for detailed configuration options

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
    (marketing)/       # Landing page, privacy, terms
    api/               # REST API route handlers
  components/
    calendar/          # Calendar view components
    kanban/            # Kanban board, columns, task cards
    marketing/         # Landing page sections
    notes/             # Markdown notes editor and lists
    settings/          # Settings panels (tokens, calendar, notifications)
    tasks/             # Task creation/editing sheets
    ui/                # shadcn/ui primitives
  hooks/               # Custom React hooks for data fetching
  lib/                 # Utilities, auth config, DB connection, offline support
  models/              # Mongoose models (User, Project, Task, Category, Label,
                       #   Note, FilterPreset, ProjectMember, PushSubscription,
                       #   Notification, NotificationPreference, AccessToken, Account)
  types/               # Shared TypeScript types
public/
  sw.js                # Service worker for offline support
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the PR process.

## License

[MIT](LICENSE)
