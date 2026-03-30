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

## False Positives / Dropped

| ID | Finding | Domain | Why Dropped |
|----|---------|--------|-------------|
