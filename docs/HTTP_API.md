# TaskNotes HTTP API

The TaskNotes HTTP API provides local HTTP access to tasks, time tracking, pomodoro, calendars, webhooks, and NLP parsing.

## Availability

- Desktop only
- Disabled by default
- Started when Obsidian starts and TaskNotes API is enabled
- Bound to loopback (`127.0.0.1`) only, not the local network
- Browser CORS requests are allowed only from loopback origins such as
  `localhost`, `127.0.0.1`, and `[::1]`
- Not available on mobile

Enable it in `Settings -> TaskNotes -> Integrations -> HTTP API`.

## Base URL

`http://localhost:{PORT}`

Default port is `8080`.

## Authentication

Authentication is optional.

- If `apiAuthToken` is empty, all API requests are accepted.
- If `apiAuthToken` is set, send `Authorization: Bearer <token>`.
- Set a token for any workflow where local browser pages, scripts, or other
  desktop apps are not fully trusted.

Example:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/health
```

## Response Format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Endpoint Index

### System

- `GET /api/health`
- `GET /api/docs`
- `GET /api/docs/ui`
- `POST /api/nlp/parse`
- `POST /api/nlp/create`

### Tasks

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/toggle-status`
- `POST /api/tasks/:id/archive`
- `POST /api/tasks/:id/complete-instance`
- `POST /api/tasks/:id/materialize-occurrence`
- `POST /api/tasks/query`
- `GET /api/filter-options`
- `GET /api/stats`

### Bases

- `POST /api/bases/default-files/update`

### Time Tracking

- `POST /api/tasks/:id/time/start`
- `POST /api/tasks/:id/time/start-with-description`
- `POST /api/tasks/:id/time/stop`
- `GET /api/tasks/:id/time`
- `GET /api/time/active`
- `GET /api/time/summary`

### Pomodoro

- `POST /api/pomodoro/start`
- `POST /api/pomodoro/stop`
- `POST /api/pomodoro/pause`
- `POST /api/pomodoro/resume`
- `GET /api/pomodoro/status`
- `GET /api/pomodoro/sessions`
- `GET /api/pomodoro/stats`

### Calendars

- `GET /api/calendars`
- `GET /api/calendars/google`
- `GET /api/calendars/microsoft`
- `GET /api/calendars/subscriptions`
- `GET /api/calendars/events`

### Webhooks

- `POST /api/webhooks`
- `GET /api/webhooks`
- `DELETE /api/webhooks/:id`
- `GET /api/webhooks/deliveries`

See `docs/webhooks.md` for event and transform details.

## Route Details

## Health

### `GET /api/health`

Returns service state plus vault metadata.

```bash
curl http://localhost:8080/api/health
```

## Tasks

### `GET /api/tasks`

Basic task listing with pagination only.

Query params:

- `limit` (default `50`, max `200`)
- `offset` (default `0`)

Important:

- Filtering params such as `status`, `priority`, `tag`, `project`, `context`, `due_before`, `due_after`, `overdue`, `completed`, `archived`, and `sort` are rejected on this endpoint with HTTP `400`.
- Use `POST /api/tasks/query` for filtering.

Example:

```bash
curl "http://localhost:8080/api/tasks?limit=25&offset=0"
```

Response fields:

- `data.tasks`
- `data.pagination` with `total`, `offset`, `limit`, `hasMore`
- `data.vault`
- `data.note`
- Task objects include configured TaskNotes user fields in `customProperties`, keyed by their frontmatter property key.

### `POST /api/tasks`

Create one task.

Required:

- `title`

Common optional fields:

- `details`, `status`, `priority`, `due`, `scheduled`
- `tags`, `contexts`, `projects`
- `recurrence`, `recurrence_anchor`, `timeEstimate`, `reminders`
- `blockedBy`

`blockedBy` accepts an array of dependency objects:

- `uid`: link or identifier for the blocking task, such as `[[Project setup]]`
- `reltype`: one of `FINISHTOSTART`, `FINISHTOFINISH`, `STARTTOSTART`, or `STARTTOFINISH`
- `gap`: optional ISO 8601 duration, such as `P1D`

`blocking` is a read-only reverse relationship in API responses. To make a task block existing tasks, update those existing tasks' `blockedBy` fields.

```bash
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Review docs","priority":"high","blockedBy":[{"uid":"[[Draft docs]]","reltype":"FINISHTOSTART"}]}'
```

Returns HTTP `201` with created task data.

### `GET /api/tasks/:id`

Get one task by path id.

- `:id` must be URL-encoded task path.
- Single-task reads include the task body in `details`.
- Configured TaskNotes user fields are returned in `customProperties`, keyed by their frontmatter property key.

```bash
curl "http://localhost:8080/api/tasks/TaskNotes%2FTasks%2FReview%20docs.md"
```

### `PUT /api/tasks/:id`

Update task with partial payload.

Configured TaskNotes user fields can be updated either by their frontmatter property key or via `customProperties`.

```bash
curl -X PUT "http://localhost:8080/api/tasks/TaskNotes%2FTasks%2FReview%20docs.md" \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress"}'
```

### `DELETE /api/tasks/:id`

Delete task file.

### `POST /api/tasks/:id/toggle-status`

Toggle task status via configured workflow.

### `POST /api/tasks/:id/archive`

Toggle archive state.

### `POST /api/tasks/:id/complete-instance`

Complete recurring instance.

Request body:

- Optional `date` (ISO string). If omitted, uses current date context.

When the recurring parent uses materialized occurrence notes, this endpoint completes the matching occurrence note if one exists. If the parent is set to **Create next after completion** and no matching occurrence note exists yet, TaskNotes creates and completes that occurrence note instead of only recording a virtual `complete_instances` entry.

### `POST /api/tasks/:id/materialize-occurrence`

Create or return a materialized occurrence note for a recurring task date. This endpoint is idempotent for the same parent and date.

Request body:

- Required `date` (ISO date string, for example `2026-06-01`)

### `POST /api/tasks/query`

Advanced filtering.

Request body is a `FilterQuery` object. `FilterQuery` is still the supported advanced query shape for the HTTP API.

The root object is a group with:

- `type: "group"`
- `id`
- `conjunction: "and" | "or"`
- `children` (conditions or groups)

Optional top-level query options:

- `sortKey`, `sortDirection`
- `groupKey`, `subgroupKey`

Example:

```json
{
  "type": "group",
  "id": "root",
  "conjunction": "and",
  "children": [
    {
      "type": "condition",
      "id": "c1",
      "property": "status",
      "operator": "is",
      "value": "open"
    }
  ],
  "sortKey": "due",
  "sortDirection": "asc"
}
```

Filter tasks by context:

```json
{
  "type": "group",
  "id": "root",
  "conjunction": "and",
  "children": [
    {
      "type": "condition",
      "id": "context",
      "property": "contexts",
      "operator": "contains",
      "value": "@office"
    }
  ],
  "sortKey": "due",
  "sortDirection": "asc"
}
```

Filter active, unarchived tasks, similar to the default available-task view:

```json
{
  "type": "group",
  "id": "root",
  "conjunction": "and",
  "children": [
    {
      "type": "condition",
      "id": "not-archived",
      "property": "archived",
      "operator": "is-not-checked"
    },
    {
      "type": "condition",
      "id": "not-completed",
      "property": "status.isCompleted",
      "operator": "is-not-checked"
    }
  ],
  "sortKey": "due",
  "sortDirection": "asc",
  "groupKey": "none"
}
```

Condition fields:

- `type`: `"condition"`
- `id`: any stable string for your client
- `property`: a task property, such as `title`, `status`, `priority`, `tags`, `contexts`, `projects`, `blockedBy`, `blocking`, `due`, `scheduled`, `completedDate`, `dateCreated`, `dateModified`, `archived`, `hasSubtasks`, `dependencies.isBlocked`, `dependencies.isBlocking`, `timeEstimate`, `recurrence`, or `status.isCompleted`
- `operator`: one of `is`, `is-not`, `contains`, `does-not-contain`, `is-before`, `is-after`, `is-on-or-before`, `is-on-or-after`, `is-empty`, `is-not-empty`, `is-checked`, `is-not-checked`, `is-greater-than`, `is-less-than`, `is-greater-than-or-equal`, or `is-less-than-or-equal`
- `value`: required for comparison operators, omitted for empty/checked operators

For user-defined fields, use `property: "user:<fieldId>"`.

Response:

- `data.tasks`
- `data.total`
- `data.filtered`
- `data.vault`

### `GET /api/filter-options`

Returns filter options for UI builders.

### `GET /api/stats`

Returns summary counts:

- `total`, `completed`, `active`, `overdue`, `archived`, `withTimeTracking`

## Bases

### `POST /api/bases/default-files/update`

Overwrite the configured default TaskNotes `.base` files with templates generated from the current TaskNotes settings. This is the same write operation as **Settings -> TaskNotes -> Views & base files -> Update files** and replaces manual edits in those configured default files.

```bash
curl -X POST http://localhost:8080/api/bases/default-files/update
```

Response fields:

- `data.created`: default files created because they were missing
- `data.updated`: existing default files overwritten with current templates
- `data.skipped`: configured default files skipped

## Time Tracking

### `POST /api/tasks/:id/time/start`

Starts a new active time entry for that task.

### `POST /api/tasks/:id/time/start-with-description`

Starts time tracking and writes `description` on the new active entry.

Request body:

```json
{
  "description": "Implementation"
}
```

### `POST /api/tasks/:id/time/stop`

Stops active time entry for that task.

### `GET /api/tasks/:id/time`

Returns per-task time summary and entries.

### `GET /api/time/active`

Returns currently active sessions across tasks.

Important:

- Multiple active sessions can exist across different tasks.

### `GET /api/time/summary`

Returns aggregate time summary.

Query params:

- `period` (for example `today`, `week`, `month`, `all`)
- `from` (ISO date)
- `to` (ISO date)

Example:

```bash
curl "http://localhost:8080/api/time/summary?period=week"
```

## Pomodoro

### `POST /api/pomodoro/start`

Starts a session.

Optional request fields:

- `taskId` (URL path of task)
- `duration` (number)

### `POST /api/pomodoro/stop`

Stops and resets current session.

### `POST /api/pomodoro/pause`

Pauses running session.

### `POST /api/pomodoro/resume`

Resumes paused session.

### `GET /api/pomodoro/status`

Returns current state plus computed totals (`totalPomodoros`, `currentStreak`, `totalMinutesToday`).

### `GET /api/pomodoro/sessions`

Returns history.

Query params:

- `limit`
- `date` (`YYYY-MM-DD`)

### `GET /api/pomodoro/stats`

Returns stats for today or provided date.

Query params:

- `date` (`YYYY-MM-DD`)

## Calendars

### `GET /api/calendars`

Returns provider connectivity overview and subscription counts.

### `GET /api/calendars/google`

Returns Google provider details.

- If disconnected, returns `{ "connected": false }`.

### `GET /api/calendars/microsoft`

Returns Microsoft provider details.

- If disconnected, returns `{ "connected": false }`.

### `GET /api/calendars/subscriptions`

Returns ICS subscriptions with runtime fields such as `lastFetched` and `lastError`.

### `GET /api/calendars/events`

Returns merged event list from connected providers and ICS subscriptions.

Query params:

- `start` (ISO date/datetime)
- `end` (ISO date/datetime)

Response includes:

- `events`
- `total`
- `sources` (counts by provider)

## Webhooks

### `POST /api/webhooks`

Registers webhook.

Required fields:

- `url`
- `events` (non-empty array)

Optional fields:

- `id`
- `secret`
- `active`
- `transformFile`
- `corsHeaders`

### `GET /api/webhooks`

Lists registered webhooks. Stored secrets are not returned.

### `DELETE /api/webhooks/:id`

Deletes webhook.

### `GET /api/webhooks/deliveries`

Returns last 100 delivery records.

## OpenAPI Docs

### `GET /api/docs`

Returns OpenAPI JSON generated from registered controllers.

### `GET /api/docs/ui`

Returns Swagger UI.

## Errors

Common status codes:

- `400` invalid request or invalid state
- `401` missing/invalid bearer token (when auth token is configured)
- `404` missing task/webhook/resource
- `500` internal error

## Security Notes

Current behavior:

- CORS allows all origins (`*`).
- Transport is HTTP only (no TLS).
- Node server is started with `server.listen(port)` and does not explicitly bind to `127.0.0.1`.

Practical guidance:

- Set an auth token.
- Treat API port as sensitive and keep it firewalled.
- If you expose this port outside localhost, route through a trusted reverse proxy and TLS.

## Troubleshooting

### API unavailable

1. Confirm API is enabled in settings.
2. Confirm Obsidian is running.
3. Confirm selected port is free.
4. Reload plugin or restart Obsidian after changing API enable/port.

### `401 Authentication required`

1. Check token value.
2. Check `Bearer ` prefix.
3. Remove whitespace around token.

### Unexpected task list behavior

If you pass filters to `GET /api/tasks`, the endpoint returns `400` by design. Use `POST /api/tasks/query`.
