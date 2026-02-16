# Pillar — Task Management App

> **Keep in sync**: This file (`CLAUDE.md`) and `.github/copilot-instructions.md` must always be updated together. Different developers use different AI tools (Claude Code, GitHub Copilot, etc.), so both files must reflect the same conventions and rules.

## Project Overview

Pillar is a Kanban-based task management app built with Next.js 16 (App Router), TypeScript, MongoDB/Mongoose, Auth.js v5 (next-auth@beta), shadcn/ui + Tailwind CSS v4, and @dnd-kit. Supports multiple users, project sharing (by email), project categories, configurable Kanban columns, recurring tasks, time tracking, calendar views, AI-powered subtask generation, real-time sync via SSE, and offline PWA mode. Deployed via Docker Compose.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router, React 19.2.3, React Compiler enabled)
- **Language**: TypeScript (strict mode, no `any`)
- **Database**: MongoDB 7 via Mongoose 9
- **Auth**: Auth.js v5 (next-auth@beta) with Credentials + Google providers, JWT sessions
- **UI**: shadcn/ui + Tailwind CSS v4 + Lucide icons
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Validation**: Zod v4
- **Toasts**: sonner (named import: `import { toast } from "sonner"`)
- **PWA/Offline**: vanilla service worker + IndexedDB via `idb`
- **Testing**: Vitest + React Testing Library + Playwright + mongodb-memory-server + fake-indexeddb
- **Package Manager**: pnpm

## Key Commands

```bash
pnpm dev              # Dev server (Turbopack) at localhost:3000
pnpm build            # Production build (output: standalone)
pnpm test             # Vitest unit/integration tests (79 files, 603 tests)
pnpm test:watch       # Tests in watch mode
pnpm test:coverage    # Tests with coverage report
pnpm test:e2e         # Playwright E2E tests (requires running dev server)
pnpm lint             # ESLint
docker compose up -d  # Full stack in Docker (app + MongoDB)
```

## Architecture

- **Single Next.js app** with App Router (`src/app/`), two route groups: `(auth)` (login/register, no sidebar) and `(dashboard)` (main app with sidebar)
- **REST API** via Route Handlers (`src/app/api/`) — every handler: auth check → `connectDB()` → Zod validate → query with `userId` filter → respond
- **MongoDB** via Mongoose 9 (`src/models/`) — singleton connection in `src/lib/db.ts` with global HMR cache. **Standalone** (no replica set) — Change Streams and transactions are unavailable
- **Auth.js v5** split across three files:
  - `src/lib/auth.config.ts` — edge-safe config (no bcryptjs/crypto imports)
  - `src/lib/auth.ts` — full config with Credentials provider
  - `src/proxy.ts` — auth middleware (Next.js 16 convention, NOT `middleware.ts`)
- **Real-time sync** via SSE + in-memory EventEmitter — see [docs/realtime-sync.md](docs/realtime-sync.md)
- **Project sharing** via `ProjectMember` model with role-based access — see [docs/project-sharing.md](docs/project-sharing.md)
- **Kanban DnD** via @dnd-kit with optimistic updates — see [docs/kanban-dnd.md](docs/kanban-dnd.md)
- **PWA/Offline**: vanilla service worker (`public/sw.js`), IndexedDB queue, `offlineFetch()` wrapper — see [docs/offline-pwa.md](docs/offline-pwa.md)
- **Time tracking**: per-task stopwatch with history — see [docs/time-tracking.md](docs/time-tracking.md)
- **AI features**: Claude-powered subtask generation — see [docs/ai-features.md](docs/ai-features.md)
- **State**: no SWR/React Query — custom hooks in `src/hooks/` with `useState` + `useCallback` + `fetch`/`offlineFetch`
- **Types duality**: Mongoose models use `ObjectId`/`Date` (`I<Model>` in `src/models/`), components use `string` IDs/dates (`src/types/index.ts`). Conversion happens at JSON serialization boundary.

## Critical Patterns

### API Route Handlers (`src/app/api/`)

- **Next.js 16**: `params` is a `Promise` — must `await params` in `[id]/route.ts`
- **Zod schemas** defined per-route-file (top-level `const`), not shared — Create and Update schemas are separate
- **Validation** returns only the first error: `result.error.issues[0].message`
- **Auth first, then DB**: `connectDB()` called after auth check to save connections on 401
- **Ownership always enforced**: every query includes `userId: session.user.id` — never trust client userId
- **Mongoose 9**: use `{ returnDocument: "after" }` (not `{ new: true }`) with `findOneAndUpdate`
- **DELETE** returns `{ success: true }` and handles cascade deletes manually
- **Catch blocks** use empty `catch` (no error variable): `} catch { return NextResponse.json(...) }`

### Hooks (`src/hooks/`)

- **Mutations** use `offlineFetch()` from `@/lib/offline-fetch` — NOT raw `fetch()` — to support offline queuing
- **GET requests** use plain `fetch()`
- State updated optimistically after mutations: `setItems(prev => [...prev, created])`
- `setTasks`/`setItems` exposed for external optimistic updates (DnD)

### Components (`src/components/`)

- Named exports only — no default exports
- `"use client"` only when hooks/browser APIs are used
- shadcn/ui primitives in `src/components/ui/`, custom components in feature folders
- Toast via `import { toast } from "sonner"` (named import, not default)
- `cn()` from `@/lib/utils` for conditional Tailwind classes
- `Label` type collision: import as `Label as LabelType` from `@/types` when `Label` from shadcn/ui is also needed
- **Accessibility**: Every `Dialog` must include `DialogDescription` and every `Sheet` must include `SheetDescription` (even if visually hidden via `className="sr-only"`). Radix UI logs console warnings without these.

### Data Models

- **Project** has default columns: `["todo", "in-progress", "review", "done"]`
- **Task.priority**: `"urgent" | "high" | "medium" | "low"` (default: `"medium"`)
- **Task.recurrence**: `{ frequency: "daily"|"weekly"|"monthly"|"yearly"|"none", interval, endDate? }`
- **User.passwordHash** is optional — OAuth-only users have no password
- **Account** links OAuth/credentials identities to users (compound unique indexes on `{provider, providerAccountId}` and `{userId, provider}`)
- Model re-registration guard: `mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema)`

## Testing

### TDD Workflow (Mandatory for All New Features)

All new features and bug fixes **must** follow test-driven development:

1. **Red**: Write tests first — confirm they fail
2. **Green**: Implement the minimum code to make tests pass
3. **Refactor**: Clean up while keeping tests green
4. A feature is **NOT done** until all its tests pass
5. After completing a feature, **always**:
   - Run the full test suite (`pnpm test`) to verify nothing is broken
   - Run the **code-simplifier agent** to review and optimize the implementation for clarity and maintainability

### Setup

- **Vitest** with jsdom, globals enabled, 30s timeout, `@/` alias via `vite-tsconfig-paths`
- `vitest.setup.ts` loads `@testing-library/jest-dom/vitest` + `fake-indexeddb/auto`
- Colocated: `foo.test.ts` next to `foo.ts`, E2E in `e2e/*.spec.ts`

### API Route Tests

```typescript
// 1. vi.hoisted() for session — must exist before vi.mock() closures
const session = vi.hoisted(() => ({
  user: { id: "...", name: "Test User", email: "test@example.com" },
  expires: "...",
}));
// 2. Mock connectDB and auth
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(session)) }));
// 3. Import and call handler directly
import { GET, POST } from "./route";
// 4. Mutate session.user.id in-place in setupFixtures() to sync with real DB user
// 5. Use clearTestDB() in afterEach (all collections)
```

### Model Tests

- Use `mongodb-memory-server` via `setupTestDB()`/`teardownTestDB()` — never mock Mongoose
- Use `Model.deleteMany({})` (subject model only) in `afterEach`
- Factories in `src/test/helpers/factories.ts` — require parent IDs (User → Category → Project → Task chain)

### Component Tests

- React Testing Library, query with `screen.getByRole()` as primary strategy
- Fake timers with `vi.useFakeTimers({ shouldAdvanceTime: true })` for debounce testing
- `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`

## Key Files

| Purpose                   | File                                        |
| ------------------------- | ------------------------------------------- |
| Auth (edge-safe)          | `src/lib/auth.config.ts`                    |
| Auth (full)               | `src/lib/auth.ts`                           |
| OAuth linking             | `src/lib/oauth-linking.ts`                  |
| Account model             | `src/models/account.ts`                     |
| Auth type augmentations   | `src/types/next-auth.d.ts`                  |
| Auth proxy                | `src/proxy.ts`                              |
| DB connection             | `src/lib/db.ts`                             |
| Shared types              | `src/types/index.ts`                        |
| Event bus (SSE)           | `src/lib/event-bus.ts`                      |
| SSE endpoint              | `src/app/api/events/route.ts`               |
| SSE client hook           | `src/hooks/use-realtime-sync.ts`            |
| Sync subscription hook    | `src/hooks/use-sync-subscription.ts`        |
| Realtime provider         | `src/components/layout/realtime-provider.tsx`|
| Per-tab session ID        | `src/lib/session-id.ts`                     |
| Offline fetch wrapper     | `src/lib/offline-fetch.ts`                  |
| Offline queue (IndexedDB) | `src/lib/offline-queue.ts`                  |
| Sync engine               | `src/lib/sync.ts`                           |
| Project access control    | `src/lib/project-access.ts`                 |
| ProjectMember model       | `src/models/project-member.ts`              |
| Test helpers              | `src/test/helpers/`                         |
| Service worker            | `public/sw.js`                              |

## Feature Documentation

Detailed documentation for each major feature lives in the `docs/` folder:

| Feature | Doc |
|---|---|
| Real-time sync (SSE) | [docs/realtime-sync.md](docs/realtime-sync.md) |
| Project sharing | [docs/project-sharing.md](docs/project-sharing.md) |
| Time tracking | [docs/time-tracking.md](docs/time-tracking.md) |
| Offline/PWA | [docs/offline-pwa.md](docs/offline-pwa.md) |
| AI features | [docs/ai-features.md](docs/ai-features.md) |
| Kanban drag & drop | [docs/kanban-dnd.md](docs/kanban-dnd.md) |
| OAuth social login | [docs/oauth-social-login.md](docs/oauth-social-login.md) |

## Test Credentials (Dev/E2E)

- **Email**: `test@pillar.dev` / **Password**: `TestPassword123!` / **Name**: `Test User`

## What NOT to Do

- Don't mock Mongoose methods — use mongodb-memory-server instead
- Don't use Pages Router patterns (getServerSideProps, etc.)
- Don't add `"use client"` to server components
- Don't install packages if shadcn already provides the component
- Don't use `any` type — use `unknown` and narrow, or define proper types
- Don't create files without tests
- Don't use `middleware.ts` — it's `src/proxy.ts` in Next.js 16
- Don't use `{ new: true }` with Mongoose — use `{ returnDocument: "after" }`
- Don't use raw `fetch()` for mutations in hooks — use `offlineFetch()`
- Don't share Zod schemas across route files — define them per-route
