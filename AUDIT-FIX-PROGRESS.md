# Bug Hunt Progress Tracker

_Last updated: 2026-03-29_

## Reported (pending fix)

| ID | Finding | Domain | Category | Reported |
|----|---------|--------|----------|----------|

## Fixed

| ID | Finding | Domain | Category | Fixed In |
|----|---------|--------|----------|----------|
| BH-001 | Backup export omits collaborator tasks; restore deletes them | Auth | MUST | pending commit |
| BH-002 | Backup restore: orphaned projects when ProjectMember.insertMany fails | Mutations | MUST | pending commit |
| BH-003 | Bulk delete bypasses active timer guard | State | MUST | pending commit |
| BH-004 | Assignee loses reminder when owner not in quiet hours | Jobs | MUST | pending commit |
| BH-005 | handleArchiveAll archives hidden tasks when filters active | Rendering | MUST | pending commit |
| BH-006 | Task reorder uses raw fetch() instead of offlineFetch() | Rendering | MUST | pending commit |
| BH-007 | MCP subtask SSE events missing data field | Integrations | MUST | pending commit |
| BH-008 | MCP create_task no columnId validation | Integrations | MUST | pending commit |
| BH-009 | Member DELETE endpoint leaks membership via error oracle | Auth | SHOULD | pending commit |
| BH-010 | Backup restore cleanup failure corrupts label names | Mutations | SHOULD | pending commit |
| BH-011 | Command palette saves partial searches on debounce | Rendering | SHOULD | pending commit |
| BH-012 | Backup export includes tasks from shared projects user doesn't own | Auth | MUST | pending commit |
| BH-013 | Project create partial write leaves project permanently inaccessible | Mutations | MUST | pending commit |
| BH-014 | Account deletion leaves ghost notifications for collaborators | Mutations | MUST | pending commit |
| BH-015 | Bulk archive bypasses active timer guard | State | MUST | pending commit |
| BH-016 | deleteSession only updates UI when navigator.onLine is true | State | MUST | pending commit |
| BH-018 | Save indicator shows "Saved" even when server request fails | Rendering | MUST | pending commit |
| BH-019 | recalculateRemindersForUser destroys manually-set reminders | Jobs | MUST | pending commit |
| BH-020 | Bulk move optimistic completedAt can diverge from server | Rendering | SHOULD | pending commit |
| BH-021 | AI-generated subtasks keep temp IDs causing silent toggle failures | Rendering | SHOULD | pending commit |
| BH-022 | MCP create_task/update_task accept any assigneeId without membership check | Integrations | SHOULD | pending commit |

## False Positives / Dropped

| ID | Finding | Domain | Why Dropped |
|----|---------|--------|-------------|
| BH-D01 | MCP GET bypass | Auth | By design — excluded from proxy matcher, validateBearerToken is the auth gate |
| BH-D02 | Promoting member to owner via PATCH | Auth | UpdateRoleSchema z.enum(["viewer","editor"]) rejects "owner" at parse time |
| BH-D03 | DELETE member cross-project lookup | Auth | findOne requires memberId belongs to specific projectId |
| BH-D04 | users/search exposing all emails | Auth | Gated behind ProjectMember.exists with owner role check |
| BH-D05 | OAuth linking race condition | Auth | Handled with 11000 duplicate-key catch in oauth-linking.ts |
| BH-D06 | JWT not refreshed on user deletion | Auth | Deleted users get 404 from all routes; practical protection |
| BH-D07 | Profile PATCH accepts arbitrary image URL | Auth | Validated as z.string().url(); no server-side fetch (no SSRF) |
| BH-D08 | Recurring task creation race with column changes | Mutations | 83% confidence, column remap on project update covers recovery |
| BH-D09 | shouldUnsetReminder leaves reminderAt on cleared dueDate | Mutations | Edge case design choice, no crash or data corruption |
| BH-D10 | bulk/assign uses direct ProjectMember.findOne | Mutations | Same DB query result as getProjectRole, no functional difference |
| BH-D11 | Recurrence duplicate on re-completing via PATCH | State | Guard !wasAlreadyCompleted correctly blocks it |
| BH-D12 | existingTask.select missing dueDate | State | findByIdAndUpdate return is full post-update document |
| BH-D13 | SSE complete action fails after session expiry | Jobs | res.redirected guard catches and opens app as fallback |
| BH-D14 | Notification dedup key undefined mismatch | Jobs | DB unique index with 11000 catch handles it |
| BH-D15 | offlineFetch synthetic response doesn't roll back | Rendering | No optimistic updates; state only updated after res.ok check |
| BH-D16 | TaskSheetForm sync overwrites during debounce | Rendering | Guard saveStatus === "saving" blocks correctly |
| BH-D17 | Task sheet closes before confirming Mark Complete | Rendering | onClose() is after await onUpdate inside try block; catch prevents close on error |
| BH-D18 | MCP catch blocks use named error variable | Integrations | err.status is inspected for 403/404 distinction; named var required |
| BH-D19 | Task.updateMany in delete_label no userId filter | Integrations | Label ObjectId already ownership-verified; $pull targets unique ID |
