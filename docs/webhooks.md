# TaskNotes Webhooks

TaskNotes webhooks send HTTP POST requests when selected events occur.

## Prerequisites

1. Enable HTTP API in `Settings -> TaskNotes -> Integrations -> HTTP API`.
2. Create at least one webhook (settings UI or API).
3. Subscribe it to one or more events.

## Event Types

Task events:

- `task.created`
- `task.updated`
- `task.deleted`
- `task.completed`
- `task.archived`
- `task.unarchived`

Time events:

- `time.started`
- `time.stopped`

Pomodoro events:

- `pomodoro.started`
- `pomodoro.completed`
- `pomodoro.interrupted`

Recurring events:

- `recurring.instance.completed`
- `recurring.instance.skipped`

Reminder events:

- `reminder.triggered`

## Payload Shape

All webhook payloads use the same top-level envelope:

```json
{
  "event": "task.created",
  "timestamp": "2026-02-21T10:30:00.000Z",
  "vault": {
    "name": "My Vault",
    "path": "/path/to/vault"
  },
  "data": {}
}
```

`data` is event-specific.

## Register and Manage Webhooks via API

### Create

`POST /api/webhooks`

Required fields:

- `url` (string)
- `events` (non-empty array)

Optional fields:

- `id`
- `secret` (auto-generated if omitted)
- `active` (default `true`)
- `transformFile`
- `corsHeaders` (default `true`)

Example:

```bash
curl -X POST http://localhost:8080/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/tasknotes",
    "events": ["task.completed", "task.created"],
    "transformFile": "TaskNotes/webhooks/slack.json"
  }'
```

### List

`GET /api/webhooks`

Returns registered hooks. Secrets are not returned.

### Delete

`DELETE /api/webhooks/:id`

### Delivery History

`GET /api/webhooks/deliveries`

Returns last 100 in-memory deliveries.

## Delivery Behavior

Current implementation behavior:

- Webhook processing is asynchronous (fire-and-forget from task operation).
- Each delivery starts with one attempt.
- Failed deliveries retry with exponential backoff: `1s`, `2s`, `4s`.
- Maximum retries: `3` retries after initial attempt (up to 4 attempts total).
- If cumulative `failureCount` for a webhook exceeds `10`, webhook is auto-disabled.
- No explicit request timeout is set in delivery fetch.

Because retries and duplicates are possible, handlers should be idempotent.

## Signature Verification

When `corsHeaders` is enabled (default), delivery includes:

- `X-TaskNotes-Event`
- `X-TaskNotes-Signature`
- `X-TaskNotes-Delivery-ID`

Signature is HMAC-SHA256 over `JSON.stringify(payload)` using webhook `secret`.

Node.js example:

```javascript
const crypto = require("crypto");

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  return signature === expected;
}
```

## Payload Transformations

A webhook can specify `transformFile` pointing to a file in your vault.

Supported file types:

- `.js`: JavaScript transform function
- `.json`: event template map with variable interpolation

If transform execution fails, TaskNotes falls back to original payload.

### JavaScript Transform Files

Expected format:

```javascript
function transform(payload) {
  return payload;
}
```

Execution model:

- File is read from the vault.
- Code is executed with `new Function(...)`.
- Returned value becomes the outgoing request body.

Important behavior:

- Returning `null` does not skip delivery. Payload body becomes JSON `null`.
- Returning an array does not fan out to multiple URLs. Array is posted to the configured single URL.
- `console.log` is available because code runs in plugin runtime context.

Example:

```javascript
function transform(payload) {
  if (payload.event === "task.completed") {
    return {
      text: `Completed: ${payload.data.task.title}`,
      event: payload.event,
      at: payload.timestamp,
    };
  }

  return payload;
}
```

### JSON Transform Files

Structure:

```json
{
  "task.completed": {
    "text": "Task completed: ${data.task.title}",
    "vault": "${vault.name}"
  },
  "default": {
    "text": "TaskNotes event: ${event}"
  }
}
```

Rules:

- Matching order: exact event key, then `default`.
- Variables use `${path.to.value}`.
- Missing variables are left unchanged.

## CORS and Headers

Webhook delivery requests are outbound server-side requests from TaskNotes.

`corsHeaders` behavior:

- `true` (default): sends TaskNotes custom headers including signature.
- `false`: only sends `Content-Type: application/json`.

Disable custom headers for endpoints that reject non-standard headers.

## Testing

### Local Test Server

Use repository script:

```bash
node test-webhook.js
```

Optional custom port:

```bash
node test-webhook.js 8080
```

Default server values:

- URL: `http://localhost:3000/webhook`
- Test secret: `test-secret-key-for-tasknotes-webhooks`

### External Inspection

For quick inspection, use a request-bin tool such as `webhook.site`.

## Troubleshooting

### No deliveries

1. Confirm HTTP API is enabled.
2. Confirm webhook is active.
3. Confirm event is subscribed.

### Signature mismatch

1. Confirm secret matches webhook config.
2. Verify your verifier hashes the exact JSON body.
3. Verify hex digest comparison.

### Webhook disabled automatically

If failures continue and `failureCount` exceeds 10, webhook is disabled.

1. Fix endpoint availability or response handling.
2. Re-enable webhook in TaskNotes settings, or recreate it via `POST /api/webhooks`.

### Transform errors

1. Confirm `transformFile` exists in vault.
2. For JS, ensure `transform` function is defined.
3. Check Obsidian console logs for transform exceptions.
