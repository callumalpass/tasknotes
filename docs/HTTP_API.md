# TaskNotes HTTP API

The TaskNotes HTTP API provides local HTTP access to tasks, time tracking, pomodoro, calendars, webhooks, and NLP parsing.

## Availability

- Desktop only
- Disabled by default
- Started when Obsidian starts and TaskNotes API is enabled
- Not available on mobile

Enable it in `Settings -> TaskNotes -> Integrations -> HTTP API`.

## Base URL

`http://localhost:{PORT}`

Default port is `8080`.

## Authentication

Authentication is optional.

- If `apiAuthToken` is empty, all API requests are accepted.
- If `apiAuthToken` is set, send `Authorization: Bearer <token>`.

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
- `POST /api/tasks/query`
- `GET /api/filter-options`
- `GET /api/stats`

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

- Filtering params such as `status`, `priority`, `tag`, `project`, `due_before`, `due_after`, `overdue`, `completed`, `archived`, and `sort` are rejected on this endpoint with HTTP `400`.
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

### `POST /api/tasks`

Create one task.

Required:

- `title`

Common optional fields:

- `details`, `status`, `priority`, `due`, `scheduled`
- `tags`, `contexts`, `projects`
- `recurrence`, `timeEstimate`

```bash
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Review docs","priority":"high"}'
```

Returns HTTP `201` with created task data.

### `GET /api/tasks/:id`

Get one task by path id.

- `:id` must be URL-encoded task path.

```bash
curl "http://localhost:8080/api/tasks/TaskNotes%2FTasks%2FReview%20docs.md"
```

### `PUT /api/tasks/:id`

Update task with partial payload.

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

### `POST /api/tasks/query`

Advanced filtering.

Request body is a `FilterQuery` object. Root object is a group with:

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
