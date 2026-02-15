# Contributing to Pillar

Thanks for your interest in contributing! This guide covers how to set up the project and the conventions we follow.

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env` and fill in your values
4. Start MongoDB locally (or use the Docker Compose setup)
5. Run the dev server: `pnpm dev`
6. Run tests: `pnpm test`

## TDD Workflow

All new features and bug fixes **must** follow test-driven development:

1. **Red** — Write tests first and confirm they fail
2. **Green** — Implement the minimum code to make tests pass
3. **Refactor** — Clean up while keeping tests green

A feature is not done until all its tests pass.

## Code Conventions

- **TypeScript strict mode** — no `any` types; use `unknown` and narrow instead
- **Named exports only** — no default exports
- **`"use client"`** only when hooks or browser APIs are used
- **Mutations** use `offlineFetch()` (not raw `fetch()`) to support offline queuing
- **Zod schemas** are defined per-route file, not shared across routes
- **Mongoose 9** — use `{ returnDocument: "after" }` instead of `{ new: true }`
- **Toast notifications** via `import { toast } from "sonner"`

## Testing

- **Unit/integration tests** are colocated: `foo.test.ts` next to `foo.ts`
- **Model tests** use `mongodb-memory-server` — never mock Mongoose
- **API route tests** use `vi.hoisted()` for session mocks
- **Component tests** use React Testing Library with `screen.getByRole()` as the primary query strategy

Run the full suite before submitting a PR:

```bash
pnpm test
pnpm lint
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the conventions above
3. Ensure all tests pass (`pnpm test`) and linting is clean (`pnpm lint`)
4. Write a clear PR description explaining what changed and why
5. Link any related issues

## Reporting Issues

Use the [GitHub issue templates](.github/ISSUE_TEMPLATE/) to report bugs or request features.
