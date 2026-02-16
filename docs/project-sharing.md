# Project Sharing

## Overview

Pillar supports multi-user project collaboration through a `ProjectMember` model. Users can share projects with others by email lookup, assigning them a role that controls their access level. Shared project mutations are broadcast to all members via the real-time sync system.

## Key Files

| Purpose | File |
|---|---|
| ProjectMember model | `src/models/project-member.ts` |
| Access control utilities | `src/lib/project-access.ts` |
| Members API (list/add) | `src/app/api/projects/[id]/members/route.ts` |
| Member API (update/remove) | `src/app/api/projects/[id]/members/[memberId]/route.ts` |
| User search API | `src/app/api/users/search/route.ts` |
| Share dialog UI | `src/components/projects/share-dialog.tsx` |
| Members hook | `src/hooks/use-project-members.ts` |
| User search hook | `src/hooks/use-user-search.ts` |
| Migration script | `scripts/migrate-project-members.ts` |

## Roles

| Role | Permissions |
|---|---|
| `owner` | Full control — manage project settings, columns, members, and all tasks |
| `editor` | Manage tasks only — create, update, delete, and reorder tasks |
| `viewer` | Read-only access — checked in API routes but not assignable through the share dialog |

## Data Model

The `ProjectMember` model has a compound unique index on `{projectId, userId}`, preventing duplicate memberships. Each record stores:

- `projectId` — reference to the shared project
- `userId` — reference to the member user
- `role` — one of `owner`, `editor`, `viewer`

## Access Control

Central authorization logic lives in `src/lib/project-access.ts` with four key functions:

- **`getAccessibleProjectIds(userId)`** — Returns all project IDs a user can access (owned + shared). Used by task and project list queries.
- **`getProjectRole(projectId, userId)`** — Returns the user's role for a specific project, or `null` if no access.
- **`requireProjectRole(projectId, userId, ...roles)`** — Throws if the user doesn't have one of the specified roles. Used as a guard in API routes.
- **`getProjectMemberUserIds(projectId)`** — Returns all member user IDs for a project. Used to populate `targetUserIds` in SSE sync events.

### Migration Fallback

For backward compatibility, if no `ProjectMember` records exist for a user, the access functions fall back to `Project.find({ userId })`. This ensures projects created before the sharing feature was added remain accessible. The migration script (`scripts/migrate-project-members.ts`) creates `ProjectMember` records for existing project owners. See [migrations-and-scripts.md](migrations-and-scripts.md) for details on running migration scripts.

## Sharing Flow

1. The project owner opens the share dialog (`share-dialog.tsx`).
2. They search for a user by email via the `use-user-search` hook, which calls `src/app/api/users/search/route.ts`.
3. On selection, a POST to `src/app/api/projects/[id]/members/route.ts` creates a `ProjectMember` record.
4. The new member immediately sees the project in their project list.
5. All subsequent mutations on the shared project broadcast SSE events to all members via `targetUserIds`.

There is no invitation system — sharing is by direct email lookup only. The target user must already have a Pillar account.

## Task Assignment

Tasks have an optional `assigneeId` field. When set via the API, it is validated against the project's member list to ensure only actual members can be assigned.

## Real-Time Sync Integration

When members are added or removed, or when any mutation occurs on a shared project, the API route calls `emitSyncEvent()` with `targetUserIds` set to all project member user IDs (from `getProjectMemberUserIds`). This ensures every collaborator receives the update.
