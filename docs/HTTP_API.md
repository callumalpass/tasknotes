# TaskNotes HTTP API

The TaskNotes HTTP API allows external applications to interact with your TaskNotes data. This enables powerful integrations with browsers, automation tools, mobile apps, and custom scripts.

## Quick Start

1. **Enable API**: Go to TaskNotes Settings → HTTP API tab (desktop only)
2. **Configure**: Set port (default 8080) and optional auth token
3. **Restart**: Restart Obsidian to start the server
4. **Test**: `curl http://localhost:8080/api/health`

## Authentication

### Optional Bearer Token
```bash
# Set token in settings, then use in requests:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/tasks
```

### No Authentication
If no token is configured, all requests are allowed from localhost.

## Base URL
```
http://localhost:{PORT}/api
```
Default port is 8080 (configurable in settings).

## Response Format

All endpoints return JSON in this format:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "optional success message"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description"
}
```

## Endpoints

### Health Check
```
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-08-12T10:30:00.000Z"
  }
}
```

### Tasks

#### List Tasks
```
GET /api/tasks
```

**Query Parameters:**

- `status` - Filter by status (e.g., "open", "completed")
- `priority` - Filter by priority (e.g., "High", "Normal")
- `project` - Filter by project name (partial match)
- `tag` - Filter by tag (partial match)
- `overdue` - "true" for overdue tasks only
- `completed` - "true" or "false"
- `archived` - "true" or "false"
- `due_before` - ISO date (e.g., "2025-08-15")
- `due_after` - ISO date
- `sort` - Field to sort by (e.g., "due:asc", "priority:desc")
- `limit` - Max number of results
- `offset` - Skip this many results

**Examples:**
```bash
# All active tasks
curl "http://localhost:8080/api/tasks?completed=false&archived=false"

# High priority overdue tasks
curl "http://localhost:8080/api/tasks?priority=High&overdue=true"

# Tasks due this week, sorted by due date
curl "http://localhost:8080/api/tasks?due_before=2025-08-19&sort=due:asc"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "path": "TaskNotes/Tasks/sample-task.md",
        "title": "Review quarterly budget",
        "status": "open",
        "priority": "High",
        "due": "2025-08-15",
        "scheduled": "2025-08-14",
        "tags": ["work", "finance"],
        "projects": ["[[Q3 Planning]]"],
        "contexts": ["@office"],
        "dateCreated": "2025-08-10T09:00:00.000Z",
        "dateModified": "2025-08-10T09:00:00.000Z"
      }
    ],
    "total": 150,
    "filtered": 1
  }
}
```

#### Create Task

```
POST /api/tasks
```

**Request Body:**

```json
{
  "title": "New task title",
  "priority": "High",
  "status": "open",
  "due": "2025-08-15",
  "scheduled": "2025-08-14",
  "tags": ["email", "urgent"],
  "projects": ["[[Work Project]]"],
  "contexts": ["@computer"],
  "details": "Additional task description",
  "timeEstimate": 60
}
```

**Required Fields:**

- `title` - Task title (max 200 characters)

**Optional Fields:**

- `priority` - Task priority
- `status` - Task status
- `due` - Due date (ISO format)
- `scheduled` - Scheduled date (ISO format)
- `tags` - Array of tag strings
- `projects` - Array of project links
- `contexts` - Array of context strings
- `details` - Task description/details
- `timeEstimate` - Estimated time in minutes

#### Get Single Task

```
GET /api/tasks/{id}
```

Where `{id}` is the task file path (URL-encoded).

#### Update Task

```
PUT /api/tasks/{id}
```

**Request Body:** Same format as create task, with partial updates supported.

#### Delete Task

```
DELETE /api/tasks/{id}
```

### Time Tracking

#### Start Time Tracking

```
POST /api/tasks/{id}/time/start
```

#### Stop Time Tracking

```
POST /api/tasks/{id}/time/stop
```

### Task Actions

#### Toggle Status

```
POST /api/tasks/{id}/toggle-status
```

Toggles between open/completed status.

#### Toggle Archive

```
POST /api/tasks/{id}/archive
```

Archives or unarchives the task.

#### Complete Recurring Instance

```
POST /api/tasks/{id}/complete-instance
```


**Request Body:**

```json
{
  "date": "2025-08-12"
}
```

### Advanced Queries

#### Query Tasks

```
POST /api/tasks/query
```


**Request Body:** Advanced FilterQuery object (see TaskNotes FilterQuery documentation).

#### Get Filter Options

```
GET /api/filter-options
```

Returns available tags, projects, statuses, and priorities for building filter UIs.

### Statistics

#### Get Task Statistics

```
GET /api/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 245,
    "completed": 189,
    "active": 45,
    "overdue": 8,
    "archived": 11,
    "withTimeTracking": 67
  }
}
```

## Integration Examples

### Browser Bookmarklet

```javascript
javascript:(function(){
  const title = document.title;
  const url = window.location.href;
  
  fetch('http://localhost:8080/api/tasks', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      title: `Review: ${title}`,
      tags: ['web'],
      details: `Source: ${url}`
    })
  }).then(r => r.json()).then(d => {
    alert(d.success ? 'Task created!' : 'Error: ' + d.error);
  });
})();
```

### Python Script

```python
import requests

def create_task(title, **kwargs):
    response = requests.post('http://localhost:8080/api/tasks', 
        json={'title': title, **kwargs})
    return response.json()

# Create task from command line
task = create_task("Call dentist", priority="High", due="2025-08-15")
print(f"Created task: {task['data']['title']}")
```

### Automation (Zapier/IFTTT)

```bash
# Webhook URL for automation services
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"{{trigger.subject}}", "tags":["email"], "details":"{{trigger.body}}"}'
```

## Error Handling

### Common Errors

- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Invalid or missing auth token
- `404 Not Found` - Task not found
- `500 Internal Server Error` - Server error

### Rate Limiting

No rate limiting currently implemented. Use responsibly.

### CORS

CORS is enabled for all origins (`*`). API is intended for localhost use only.

## Security Notes

- **Localhost Only**: API server only accepts connections from localhost
- **Desktop Only**: API is not available on mobile platforms
- **Optional Auth**: Bearer token authentication is optional but recommended
- **No HTTPS**: Traffic is unencrypted (localhost only)

## Troubleshooting

### API Not Starting

1. Check that API is enabled in settings
2. Ensure port is not in use by another application
3. Try different port (1024-65535)
4. Check Obsidian console for errors

### Connection Refused

1. Verify API is enabled and Obsidian is running
2. Check correct port number
3. Ensure using `http://` not `https://`
4. Try `127.0.0.1` instead of `localhost`

### Authentication Errors

1. Verify token matches exactly (case-sensitive)
2. Include `Bearer ` prefix in Authorization header
3. Check for trailing spaces in token


