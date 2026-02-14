# Pillar — Task Management App

## Project Overview

Pillar is a Kanban-based task management app for organizing work and personal tasks. Built with Next.js 16 (App Router), TypeScript, MongoDB/Mongoose, Auth.js v5, shadcn/ui + Tailwind CSS v4, and @dnd-kit for drag-and-drop. Deployed via Docker Compose.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, React Compiler)
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB 7 via Mongoose 9
- **Auth**: Auth.js v5 (next-auth@beta) with Credentials provider, JWT sessions
  - Edge-safe config: `src/lib/auth.config.ts` (no Node.js crypto imports)
  - Full config with Credentials provider: `src/lib/auth.ts`
  - Proxy (auth middleware): `src/proxy.ts` (Next.js 16 convention, replaces `middleware.ts`)
- **UI**: shadcn/ui components + Tailwind CSS v4
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Validation**: Zod v4
- **Testing**: Vitest + React Testing Library + Playwright + mongodb-memory-server
- **Package Manager**: pnpm

## Key Commands

```bash
pnpm dev              # Start dev server (port 3000)
pnpm build            # Production build
pnpm test             # Run unit/integration tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report
pnpm test:e2e         # Run E2E tests (Playwright)
pnpm lint             # Run ESLint
docker compose up     # Start app + MongoDB in Docker
docker compose up -d  # Start in detached mode
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (login, register) - no sidebar
│   ├── (dashboard)/        # Main app pages - with sidebar layout
│   │   ├── projects/[id]/  # Kanban board per project
│   │   ├── overview/       # Cross-project task overview
│   │   └── calendar/       # Calendar view
│   └── api/                # Route Handlers (REST API)
│       ├── categories/     # Category CRUD
│       ├── projects/       # Project CRUD + column management
│       └── tasks/          # Task CRUD + move/reorder
├── components/
│   ├── ui/                 # shadcn/ui components (auto-generated)
│   ├── kanban/             # Kanban board components
│   └── layout/             # Sidebar, topbar, navigation
├── lib/
│   ├── auth.ts             # Auth.js configuration
│   ├── db.ts               # Mongoose connection singleton
│   └── utils.ts            # Utility functions (cn, etc.)
├── models/                 # Mongoose schemas (User, Category, Project, Task)
├── hooks/                  # Custom React hooks
├── types/                  # Shared TypeScript types
└── test/helpers/           # Test utilities (DB setup, factories, auth mocks)
e2e/                        # Playwright E2E tests
```

## Architecture Decisions

- **JWT sessions** (not DB sessions) — required for offline PWA support
- **Optimistic UI updates** for drag-and-drop — API latency must not block UX
- **mongodb-memory-server** for tests — never mock Mongoose methods
- **Colocated test files** — `*.test.ts(x)` next to source files
- **E2E for DnD and async Server Components** — jsdom can't test these properly
- **Route Handlers** tested by importing handler functions directly with mock NextRequest

## TDD Workflow

1. **Write tests first** — define expected behavior before implementation
2. **Run tests** — confirm they fail (red)
3. **Implement** — write minimal code to pass (green)
4. **Refactor** — clean up while keeping tests green
5. A feature is NOT done until all its tests pass

## Code Style

- Functional React components only (no class components)
- Named exports (not default exports) for components and utilities
- `"use client"` directive only on components that need browser APIs or hooks
- `@/` path aliases for all imports from src/
- Zod schemas for all API input validation
- API errors return `NextResponse.json({ error: "message" }, { status: code })`
- Never use `any` type — use `unknown` and narrow, or define proper types

## Testing Conventions

- Model tests: use mongodb-memory-server, test validation, required fields, indexes
- API route tests: import handler directly, use mock NextRequest, mock auth session
- Component tests: React Testing Library, test rendering + user interactions
- E2E tests: Playwright, test full user flows (auth, kanban DnD, navigation)
- Test file naming: `*.test.ts` (unit/integration), `*.spec.ts` (E2E in e2e/)
- Each test file: `beforeAll` setup, `afterEach` clear, `afterAll` teardown

## Test Credentials (Dev/E2E)

- **Email**: `test@pillar.dev`
- **Password**: `TestPassword123!`
- **Name**: `Test User`

This user is registered in the local MongoDB. Use these credentials for manual testing and Playwright E2E tests.

## What NOT to Do

- Don't mock Mongoose methods — use mongodb-memory-server instead
- Don't use Pages Router patterns (getServerSideProps, etc.)
- Don't add `"use client"` to server components
- Don't install packages if shadcn already provides the component
- Don't use `any` type
- Don't create files without tests
- Don't skip writing tests before marking a feature complete
