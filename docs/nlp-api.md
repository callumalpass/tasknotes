# TaskNotes NLP API

The NLP API parses natural-language task text and optionally creates a task.

In-vault scripts can also call the parser directly from the loaded plugin:

```javascript
const tasknotes = app.plugins.plugins.tasknotes;
const parsed = tasknotes.api.parseNaturalLanguage("Review PR tomorrow #code @work");
```

For the full in-process API exposed at `tasknotes.api`, including task updates, time tracking, settings snapshots, and events, see [TaskNotes JavaScript API](javascript-api.md).

## Endpoints

- `POST /api/nlp/parse`
- `POST /api/nlp/create`

Both endpoints require a JSON body with `text`.

## Request Format

```json
{
  "text": "Review PR #123 tomorrow high priority @work"
}
```

Notes:

- `text` is required and must be a string.
- Per-request `locale` is not currently supported.
- Parser language comes from TaskNotes settings (`nlpLanguage`).

## `POST /api/nlp/parse`

Parses text and returns two objects:

- `parsed`: direct parser output
- `taskData`: normalized task payload that would be used for creation

Example response (shape):

```json
{
  "success": true,
  "data": {
    "parsed": {
      "title": "Review PR",
      "tags": ["123"],
      "contexts": ["work"],
      "projects": [],
      "priority": "high",
      "status": null,
      "dueDate": "2026-02-22",
      "scheduledDate": null,
      "dueTime": null,
      "scheduledTime": null,
      "recurrence": null,
      "estimate": null,
      "isCompleted": false
    },
    "taskData": {
      "title": "Review PR",
      "priority": "high",
      "status": "open",
      "tags": ["123"],
      "contexts": ["work"],
      "due": "2026-02-22",
      "dateCreated": "2026-02-22T09:00:00.000Z",
      "dateModified": "2026-02-22T09:00:00.000Z"
    }
  }
}
```

If parser does not detect status, `taskData.status` falls back to your configured default task status. Parsed due and scheduled date-times in `taskData` use the same `YYYY-MM-DDTHH:mm` format as created tasks, and NLP trigger values for user-defined fields are returned under `customFrontmatter`.

## `POST /api/nlp/create`

Parses text and creates a task in one call.

Returns HTTP `201` on success.

Example:

```bash
curl -X POST http://localhost:8080/api/nlp/create \
  -H "Content-Type: application/json" \
  -d '{"text":"Call mom due friday 2pm #personal"}'
```

Response fields:

- `data.task` (created task)
- `data.parsed` (parser output)

## What the Parser Extracts

The parser can extract:

- Dates and times (`tomorrow`, `friday 2pm`, ISO dates)
- Priority terms (`high priority`, `urgent`, symbol patterns)
- Status terms (mapped to your configured statuses)
- Tags (`#tag`)
- Contexts (`@context`)
- Projects (`+project`)
- Time estimates (`2h`, `30min`, `estimate 45m`)
- Recurrence (`daily`, `weekly`, `every monday`)

Exact parsing behavior depends on your TaskNotes NLP settings and trigger configuration.

## In-Vault Parser Method

Templater, QuickAdd, MetaBind, and other in-vault scripts can use the loaded plugin instance directly:

```javascript
const tasknotes = app.plugins.plugins.tasknotes;
const parsed = tasknotes.api.parseNaturalLanguage("Write draft friday 2pm #writing @desk");
```

`parseNaturalLanguage(text)` returns the same parser output shape as `data.parsed` from `POST /api/nlp/parse`. It uses your current TaskNotes settings, including custom status values, priority values, NLP language, NLP trigger configuration, user fields, and calendar locale.

This method only parses text. It does not create or modify task files.

For task creation and updates from in-vault scripts or companion plugins, use the broader [TaskNotes JavaScript API](javascript-api.md).

Example Templater use:

```javascript
<%*
const tasknotes = app.plugins.plugins.tasknotes;
const text = await tp.system.prompt("Task");
const parsed = tasknotes.api.parseNaturalLanguage(text);
tR += `title: ${parsed.title}`;
%>
```

## Error Responses

Common errors:

- `400`: missing/invalid `text`
- `401`: auth required (if API token is enabled)
- `500`: parse/processing error

Error shape:

```json
{
  "success": false,
  "error": "Text field is required and must be a string"
}
```

## Client Examples

### JavaScript

```javascript
async function parseTask(text) {
  const response = await fetch("http://localhost:8080/api/nlp/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return response.json();
}

async function createTaskFromText(text) {
  const response = await fetch("http://localhost:8080/api/nlp/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return response.json();
}
```

### Python

```python
import requests


def parse_task(text):
    response = requests.post(
        "http://localhost:8080/api/nlp/parse",
        json={"text": text},
    )
    return response.json()


def create_task_from_text(text):
    response = requests.post(
        "http://localhost:8080/api/nlp/create",
        json={"text": text},
    )
    return response.json()
```

## Authentication

If API auth token is enabled, include bearer token:

```http
Authorization: Bearer YOUR_TOKEN
```
