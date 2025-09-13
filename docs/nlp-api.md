
# TaskNotes NLP API

TaskNotes now exposes its natural language parsing capabilities through API endpoints, allowing external clients to parse task descriptions and create tasks using natural language input.

## Endpoints

### POST /api/nlp/parse

Parses natural language input and returns structured task data without creating a task.

**Request:**
```json
{
  "text": "Review PR #123 tomorrow high priority @work",
  "locale": "en"
}
```

**Response:**
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
      "status": "todo",
      "dueDate": "2024-08-13",
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
      "status": "todo",
      "tags": ["123"],
      "contexts": ["work"],
      "projects": [],
      "due": "2024-08-13",
      "scheduled": null,
      "recurrence": null,
      "timeEstimate": null
    }
  }
}
```

### POST /api/nlp/create

Parses natural language input and creates a task in one step.

**Request:**
```json
{
  "text": "Call mom due friday 2pm #personal",
  "locale": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "TaskNotes/Tasks/Call mom.md",
      "title": "Call mom",
      "filePath": "TaskNotes/Tasks/Call mom.md",
      "priority": "medium",
      "status": "todo",
      "tags": ["personal"],
      "contexts": [],
      "projects": [],
      "due": "2024-08-16 14:00"
    },
    "parsed": {
      "title": "Call mom",
      "tags": ["personal"],
      "contexts": [],
      "projects": [],
      "priority": null,
      "status": "todo",
      "dueDate": "2024-08-16",
      "dueTime": "14:00",
      "scheduledDate": null,
      "scheduledTime": null,
      "recurrence": null,
      "estimate": null,
      "isCompleted": false
    }
  }
}
```

## Natural Language Parsing Features

The NLP parser can extract the following from text input:

### Dates and Times
- **Absolute**: "tomorrow", "friday", "next week", "2024-08-15"
- **Relative**: "today", "tomorrow", "next monday"
- **Times**: "2pm", "14:00", "at 6pm"
- **Keywords**: "due friday", "scheduled tomorrow"

### Priority Levels
- **Keywords**: "high priority", "low priority", "urgent"
- **Symbols**: "!!!" (high), "!!" (medium), "!" (low)

### Tags
- **Format**: "#tag", "#personal", "#work"
- **Extracted**: Becomes task tags

### Contexts
- **Format**: "@context", "@work", "@home"
- **Extracted**: Becomes task contexts

### Projects
- **Format**: "+project", "+website-redesign"
- **Extracted**: Becomes task projects

### Time Estimates
- **Format**: "2h", "30min", "estimate 45m"
- **Extracted**: Converted to minutes

### Recurrence
- **Keywords**: "daily", "weekly", "monthly", "every monday"
- **Format**: Converted to RRule format

### Status
- **Keywords**: "done", "completed", "todo", "in-progress"
- **Custom**: Uses your configured status types

### Multi-language Support

The NLP parser supports multiple languages. You can specify the language to use for parsing by providing a `locale` parameter in the request body. The following locales are supported:

- `en` (English)
- `de` (German)
- `es` (Spanish)
- `fr` (French)
- `it` (Italian)
- `ja` (Japanese)
- `nl` (Dutch)
- `pt` (Portuguese)
- `ru` (Russian)
- `sv` (Swedish)
- `uk` (Ukrainian)
- `zh` (Chinese)

If no locale is provided, the parser will default to English.

## Example Inputs

| Input | Extracted |
|-------|-----------|
| `Review PR #123 tomorrow high priority @work` | Title: "Review PR", Tags: ["123"], Contexts: ["work"], Priority: "high", Due: tomorrow |
| `Buy groceries today at 6pm` | Title: "Buy groceries", Scheduled: today 18:00 |
| `Weekly team meeting every monday 10am` | Title: "Weekly team meeting", Recurrence: "weekly", Scheduled: mondays 10:00 |
| `Fix bug estimate 2h high priority @urgent` | Title: "Fix bug", Estimate: 120 min, Priority: "high", Contexts: ["urgent"] |
| `Call mom due friday 2pm #personal` | Title: "Call mom", Due: friday 14:00, Tags: ["personal"] |

## Error Handling

Both endpoints return standard error responses:

```json
{
  "success": false,
  "error": "Text field is required and must be a string"
}
```

Common errors:
- **400**: Missing or invalid `text` field
- **401**: Authentication required (if API token configured)
- **500**: Internal server error during parsing or task creation

## Client Usage

### JavaScript Example
```javascript
// Parse text only
async function parseTask(text, locale = 'en') {
  const response = await fetch('http://localhost:8080/api/nlp/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, locale })
  });
  return response.json();
}

// Parse and create task
async function createTaskFromText(text, locale = 'en') {
  const response = await fetch('http://localhost:8080/api/nlp/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, locale })
  });
  return response.json();
}
```

### Python Example
```python
import requests

def parse_task(text, locale='en'):
    response = requests.post('http://localhost:8080/api/nlp/parse', 
                           json={'text': text, 'locale': locale})
    return response.json()

def create_task_from_text(text, locale='en'):
    response = requests.post('http://localhost:8080/api/nlp/create', 
                           json={'text': text, 'locale': locale})
    return response.json()
```

## Integration Benefits

- **Mobile Apps**: Parse voice-to-text input
- **CLI Tools**: Natural language task creation
- **Chat Bots**: Process user messages
- **Email Integration**: Parse forwarded emails
- **Browser Extensions**: Smart task creation
- **Third-party Apps**: Integrate with existing workflows

## Authentication

If you have an API authentication token configured in TaskNotes settings, include it in requests:

```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer your-api-token'
}
```

## User Settings Integration

The NLP parser uses your TaskNotes configuration:
- **Custom Status Types**: Your configured statuses
- **Custom Priorities**: Your priority levels  
- **Default Behavior**: Scheduled vs due date preferences
- **Task Creation Defaults**: Applied to created tasks
