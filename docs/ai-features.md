# AI Features

## Overview

Pillar integrates AI-powered subtask generation to help users break down tasks. The feature uses the Vercel AI SDK with configurable model providers (OpenAI, Anthropic, Google) and can be enabled or disabled via environment variables.

## Key Files

| Purpose | File |
|---|---|
| Subtask generation API | `src/app/api/ai/generate-subtasks/route.ts` |
| AI status endpoint | `src/app/api/ai/status/route.ts` |
| Model configuration | `src/lib/ai.ts` |
| UI integration | `src/components/tasks/task-sheet.tsx` (Generate subtasks button) |

## Configuration

AI features are controlled by environment variables:

| Variable | Description | Example |
|---|---|---|
| `AI_PROVIDER` | The AI provider to use | `openai`, `anthropic`, `google` |
| `AI_MODEL` | The specific model ID | `gpt-4o`, `claude-sonnet-4-20250514`, `gemini-pro` |

The `src/lib/ai.ts` module exports:

- **`isAIEnabled()`** — Returns `true` if both `AI_PROVIDER` and `AI_MODEL` are set. Used by the UI to conditionally show AI features and by the status endpoint.
- **`getAIModel()`** — Returns the configured model instance from the Vercel AI SDK, based on the provider and model env vars.

## API Endpoints

### `POST /api/ai/generate-subtasks`

Generates subtasks for a given task using AI. Accepts the task title, description, and context, then uses `generateObject()` from the Vercel AI SDK to produce structured subtask suggestions. Returns an array of subtask objects.

### `GET /api/ai/status`

Returns whether AI features are enabled (`isAIEnabled()`). The client uses this to determine whether to show AI-related UI elements.

## UI Integration

In the task sheet (`src/components/tasks/task-sheet.tsx`), a "Generate subtasks" button with a Sparkles icon appears when AI is enabled. Clicking it calls the subtask generation API and populates the task's subtask list with the AI-generated suggestions. Users can review, edit, or remove generated subtasks before saving.

## Implementation Notes

- The Vercel AI SDK's `generateObject()` is used (not `generateText()`) to get structured, typed output that maps directly to the subtask schema.
- The feature degrades gracefully: if AI is not configured, the button is hidden and the API returns an appropriate error.
- All AI API calls require authentication — the user must be logged in.
