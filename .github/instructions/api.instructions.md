---
applyTo: "src/app/api/**"
---

# API Route Handler Instructions

## Pattern

Each route file exports named async functions: `GET`, `POST`, `PATCH`, `DELETE`.

## Authentication

Every API route must verify the user session:

```typescript
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... handler logic using session.user.id
}
```

## Input Validation

Use Zod schemas defined at the top of each route file:

```typescript
import { z } from "zod";

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  // ...
});
```

Parse request body with `.safeParse()` and return 400 on validation failure.

## Error Responses

Always return structured JSON errors with correct HTTP status codes:

- `400` — Validation error (bad input)
- `401` — Unauthorized (no session)
- `403` — Forbidden (accessing another user's resource)
- `404` — Resource not found
- `500` — Internal server error

Format: `NextResponse.json({ error: "description" }, { status: code })`

## Authorization

Always filter queries by `userId` from the session. Never trust client-provided userId.
Verify resource ownership before update/delete operations.

For shared projects, use `src/lib/project-access.ts` to check membership and roles:
- `requireProjectRole(projectId, userId, "owner", "editor")` — guards mutation routes
- `getAccessibleProjectIds(userId)` — for listing across owned + shared projects
- `getProjectMemberUserIds(projectId)` — for populating `targetUserIds` in sync events

## Real-Time Sync Events

All mutation routes (POST, PATCH, DELETE) must call `emitSyncEvent()` after successful writes:

```typescript
import { emitSyncEvent } from "@/lib/event-bus";

emitSyncEvent({
  entity: "task", // task | project | label | category | member
  action: "created", // created | updated | deleted
  userId: session.user.id,
  sessionId: request.headers.get("x-session-id") || "",
  entityId: created._id.toString(),
  projectId: projectId.toString(),
  targetUserIds, // from getProjectMemberUserIds()
  data: created.toJSON(),
  timestamp: Date.now(),
});
```

## Database

Call `connectDB()` at the start of each handler to ensure connection is established.
MongoDB is standalone (no replica set) — do NOT use `startSession()` or transactions.
