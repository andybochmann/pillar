# Pillar — Copilot Instructions

## Project Summary

Pillar is a Kanban-based task management app built with Next.js 16 (App Router), TypeScript, MongoDB/Mongoose, Auth.js v5 (next-auth@beta), shadcn/ui + Tailwind CSS v4, and @dnd-kit. It supports multiple users, project categories, configurable Kanban columns, recurring tasks, calendar views, and offline PWA mode.

## Architecture

- **Monorepo**: Single Next.js app with App Router (`src/app/`)
- **API**: REST via Next.js Route Handlers (`src/app/api/`)
- **Database**: MongoDB via Mongoose schemas (`src/models/`)
- **Auth**: Auth.js v5 with Credentials provider and JWT sessions (`src/lib/auth.ts`)
- **Components**: shadcn/ui base components (`src/components/ui/`), custom components alongside
- **State**: Server components for data fetching, client components for interactivity

## Build & Validation

```bash
pnpm dev              # Dev server at localhost:3000
pnpm build            # Production build
pnpm test             # Vitest unit/integration tests
pnpm test:watch       # Tests in watch mode
pnpm test:e2e         # Playwright E2E tests
pnpm lint             # ESLint
docker compose up -d  # Full stack in Docker (app + MongoDB)
```

## Testing (TDD Approach)

1. Write tests before implementation
2. Colocated test files: `foo.test.ts` next to `foo.ts`
3. E2E tests in `e2e/*.spec.ts` (Playwright)
4. Use `mongodb-memory-server` for database tests — never mock Mongoose
5. Mock Auth.js sessions via `src/test/helpers/auth.ts`
6. Test data factories in `src/test/helpers/factories.ts`

## Coding Conventions

- TypeScript strict mode, no `any` types
- Functional components only, named exports
- `"use client"` only when component uses hooks or browser APIs
- `@/` import alias for everything under `src/`
- Zod schemas for API input validation (define next to route handler)
- API responses: `NextResponse.json(data, { status })` with proper HTTP codes
- Error format: `{ error: "Human-readable message" }`
- File naming: kebab-case for files, PascalCase for components, camelCase for functions

## Data Models (Mongoose)

- **User**: name, email, passwordHash, image
- **Category**: name, color, icon, userId, order
- **Project**: name, description, categoryId, userId, columns[], archived
- **Task**: title, description, projectId, userId, columnId, priority, dueDate, recurrence, order, labels[], completedAt

## Key Patterns

- Singleton Mongoose connection in `src/lib/db.ts` (reused across requests)
- Auth proxy via `src/proxy.ts` (Next.js 16 convention) protecting all routes except `/login`, `/register`
- Edge-safe auth config in `src/lib/auth.config.ts` (no bcryptjs/crypto imports)
- Optimistic UI updates for drag-and-drop operations
- shadcn/ui Sheet component for task detail editing (slide-over panel)
- Priority enum: "urgent" | "high" | "medium" | "low"
- Recurrence: { frequency: "daily"|"weekly"|"monthly"|"yearly"|"none", interval, endDate? }

## Test Credentials (Dev/E2E)

- **Email**: `test@pillar.dev`
- **Password**: `TestPassword123!`
- **Name**: `Test User`

Registered in local MongoDB. Use for manual testing and Playwright E2E tests.
