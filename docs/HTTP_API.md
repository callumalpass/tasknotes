# TaskNotes HTTP API

The TaskNotes HTTP API allows external applications to interact with your TaskNotes data. This enables powerful integrations with browsers, automation tools, mobile apps, and custom scripts.

## Quick Start

1. **Enable API**: Go to TaskNotes Settings → Integrations → HTTP API (desktop only)
2. **Configure**: Set port (default 8080) and optional auth token
3. **Restart**: Restart Obsidian to apply API enable/port changes and start the server
4. **Test**: `curl http://localhost:8080/api/health`
5. **Explore**: Visit `http://localhost:8080/api/docs/ui` for interactive documentation

## Interactive Documentation

TaskNotes provides comprehensive API documentation through Swagger UI:

- **OpenAPI Specification**: `GET /api/docs` - Machine-readable API spec in OpenAPI 3.0 format
- **Interactive Docs**: `GET /api/docs/ui` - Swagger UI for exploring and testing endpoints

The interactive documentation includes:
- Complete endpoint documentation with examples
- Request/response schemas
- Try-it-out functionality for testing endpoints
- Authentication setup for protected endpoints

## Authentication

### Optional Bearer Token
```bash
# Set token in settings, then use in requests:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/tasks
```

### No Authentication
If no token is configured, all API requests are allowed without authentication.

### Security Warning
The HTTP API is intended for local use. Any client that can reach your configured API port can send requests if authentication is disabled. Always set an authentication token unless you are in a fully trusted environment.

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

Control and query time tracking data for tasks with comprehensive analytics and reporting capabilities.

#### Start Time Tracking

```
POST /api/tasks/{id}/time/start
```

Start time tracking for a specific task.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "path/to/task.md",
    "title": "Work on API integration",
    "status": "in-progress",
    "timeEntries": [
      {
        "startTime": "2025-08-14T10:00:00.000Z",
        "description": null
      }
    ]
  }
}
```

#### Start Time Tracking with Description

```
POST /api/tasks/{id}/time/start-with-description
```

Start time tracking with an optional description of the work being done.

**Request Body:**
```json
{
  "description": "Working on API endpoint implementation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "path/to/task.md",
      "title": "Work on API integration"
    },
    "message": "Time tracking started with description: Working on API endpoint implementation"
  }
}
```

#### Stop Time Tracking

```
POST /api/tasks/{id}/time/stop
```

Stop the currently active time tracking session for a task.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "path/to/task.md",
    "title": "Work on API integration",
    "timeEntries": [
      {
        "startTime": "2025-08-14T10:00:00.000Z",
        "endTime": "2025-08-14T11:30:00.000Z",
        "duration": 90,
        "description": "Working on API endpoint implementation"
      }
    ]
  }
}
```

#### Get Task Time Data

```
GET /api/tasks/{id}/time
```

Get comprehensive time tracking data for a specific task.

**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "path/to/task.md",
      "title": "Work on API integration",
      "status": "in-progress",
      "priority": "high"
    },
    "summary": {
      "totalMinutes": 180,
      "totalHours": 3.0,
      "totalSessions": 3,
      "completedSessions": 2,
      "activeSessions": 1,
      "averageSessionMinutes": 60
    },
    "activeSession": {
      "startTime": "2025-08-14T14:00:00.000Z",
      "description": "Final testing phase",
      "elapsedMinutes": 15
    },
    "timeEntries": [
      {
        "startTime": "2025-08-14T10:00:00.000Z",
        "endTime": "2025-08-14T11:30:00.000Z",
        "description": "Initial implementation",
        "duration": 90,
        "isActive": false
      },
      {
        "startTime": "2025-08-14T13:00:00.000Z",
        "endTime": "2025-08-14T13:45:00.000Z",
        "description": "Code review and fixes",
        "duration": 45,
        "isActive": false
      },
      {
        "startTime": "2025-08-14T14:00:00.000Z",
        "endTime": null,
        "description": "Final testing phase",
        "duration": 15,
        "isActive": true
      }
    ]
  }
}
```

#### Get Active Time Sessions

```
GET /api/time/active
```

Get all currently active time tracking sessions across all tasks.

**Response:**
```json
{
  "success": true,
  "data": {
    "activeSessions": [
      {
        "task": {
          "id": "path/to/task1.md",
          "title": "API Integration",
          "status": "in-progress",
          "priority": "high",
          "tags": ["development", "api"],
          "projects": ["[[Project Alpha]]"]
        },
        "session": {
          "startTime": "2025-08-14T14:00:00.000Z",
          "description": "Final testing phase",
          "elapsedMinutes": 25
        },
        "elapsedMinutes": 25
      },
      {
        "task": {
          "id": "path/to/task2.md",
          "title": "Documentation Update",
          "status": "open",
          "priority": "normal",
          "tags": ["documentation"],
          "projects": ["[[Project Beta]]"]
        },
        "session": {
          "startTime": "2025-08-14T13:45:00.000Z",
          "description": "Writing API examples",
          "elapsedMinutes": 40
        },
        "elapsedMinutes": 40
      }
    ],
    "totalActiveSessions": 2,
    "totalElapsedMinutes": 65
  }
}
```

#### Get Time Summary

```
GET /api/time/summary
```

Get time tracking statistics and summaries with flexible date filtering.

**Query Parameters:**
- `period` - Time period: `today`, `week`, `month`, `all` (default: `today`)
- `from` - Start date for custom period (ISO format: `2025-08-01`)
- `to` - End date for custom period (ISO format: `2025-08-15`)

**Examples:**
```bash
# Today's time summary
curl "http://localhost:8080/api/time/summary"

# This week's summary
curl "http://localhost:8080/api/time/summary?period=week"

# Custom date range
curl "http://localhost:8080/api/time/summary?from=2025-08-01&to=2025-08-15"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "today",
    "dateRange": {
      "from": "2025-08-14T00:00:00.000Z",
      "to": "2025-08-14T23:59:59.999Z"
    },
    "summary": {
      "totalMinutes": 320,
      "totalHours": 5.33,
      "tasksWithTime": 8,
      "activeTasks": 2,
      "completedTasks": 3
    },
    "topTasks": [
      {
        "task": "projects/api-integration.md",
        "title": "API Integration",
        "minutes": 120
      },
      {
        "task": "projects/documentation.md", 
        "title": "Documentation Update",
        "minutes": 95
      }
    ],
    "topProjects": [
      {
        "project": "[[Project Alpha]]",
        "minutes": 180
      },
      {
        "project": "[[Project Beta]]",
        "minutes": 140
      }
    ],
    "topTags": [
      {
        "tag": "development",
        "minutes": 200
      },
      {
        "tag": "documentation", 
        "minutes": 120
      }
    ]
  }
}
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

#### Get Aggregated Time Estimates

```
GET /api/time-stats
```

Aggregates the `timeEstimate` for tasks within a given date range. The range can be a predefined period or a custom start/end date.

**Query Parameters:**

- `range` - A predefined range. Can be one of `daily`, `weekly`, `monthly`, `yearly`.
- `start` - A start date for a custom range, in `YYYY-MM-DD` format. Must be used with `end`.
- `end` - An end date for a custom range, in `YYYY-MM-DD` format. Must be used with `start`.

**Examples:**
```bash
# Get total estimated time for tasks this week
curl "http://localhost:8080/api/time-stats?range=weekly"

# Get total estimated time for a custom range
curl "http://localhost:8080/api/time-stats?start=2025-01-01&end=2025-01-31"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalMinutes": 750
  }
}
```

### Pomodoro

Control pomodoro sessions programmatically through the API.

#### Start Pomodoro Session

```
POST /api/pomodoro/start
```

**Request Body (Optional):**

```json
{
  "taskId": "path/to/task.md"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "pomo_123",
      "type": "work",
      "duration": 1500,
      "startTime": "2025-08-13T10:00:00.000Z"
    },
    "task": {
      "id": "path/to/task.md",
      "title": "Work on API integration"
    },
    "message": "Pomodoro session started"
  }
}
```

#### Stop Pomodoro Session

```
POST /api/pomodoro/stop
```

#### Pause Pomodoro Session

```
POST /api/pomodoro/pause
```

#### Resume Pomodoro Session

```
POST /api/pomodoro/resume
```

#### Get Pomodoro Status

```
GET /api/pomodoro/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "timeRemaining": 900,
    "currentSession": {
      "id": "pomo_123",
      "type": "work",
      "duration": 1500,
      "startTime": "2025-08-13T10:00:00.000Z"
    },
    "totalPomodoros": 42,
    "currentStreak": 3,
    "totalMinutesToday": 180
  }
}
```

#### Get Pomodoro Session History

```
GET /api/pomodoro/sessions
```

**Query Parameters:**

- `limit` - Maximum number of sessions to return
- `date` - Filter sessions by date (YYYY-MM-DD)

**Examples:**

```bash
# Get last 10 sessions
curl "http://localhost:8080/api/pomodoro/sessions?limit=10"

# Get sessions for specific date
curl "http://localhost:8080/api/pomodoro/sessions?date=2025-08-13"
```

#### Get Pomodoro Statistics

```
GET /api/pomodoro/stats
```

**Query Parameters:**

- `date` - Get stats for specific date (YYYY-MM-DD), defaults to today

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSessions": 15,
    "completedSessions": 12,
    "interruptedSessions": 3,
    "totalFocusTime": 300,
    "workSessions": 10,
    "breakSessions": 5,
    "longestStreak": 8,
    "averageSessionLength": 24.5
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

### Pomodoro Timer Integration

```javascript
// Simple Pomodoro timer controller
class PomodoroController {
  constructor(apiUrl = 'http://localhost:8080') {
    this.apiUrl = apiUrl;
  }

  async startSession(taskId = null) {
    const body = taskId ? { taskId } : {};
    const response = await fetch(`${this.apiUrl}/api/pomodoro/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async getStatus() {
    const response = await fetch(`${this.apiUrl}/api/pomodoro/status`);
    return response.json();
  }

  async pause() {
    const response = await fetch(`${this.apiUrl}/api/pomodoro/pause`, {
      method: 'POST'
    });
    return response.json();
  }

  async resume() {
    const response = await fetch(`${this.apiUrl}/api/pomodoro/resume`, {
      method: 'POST'
    });
    return response.json();
  }

  async stop() {
    const response = await fetch(`${this.apiUrl}/api/pomodoro/stop`, {
      method: 'POST'
    });
    return response.json();
  }
}

// Usage
const pomodoro = new PomodoroController();

// Start a session for a specific task
await pomodoro.startSession('Projects/MyProject.md');

// Check current status
const status = await pomodoro.getStatus();
console.log(`Time remaining: ${Math.floor(status.data.timeRemaining / 60)} minutes`);
```

### Time Tracking Integration

```javascript
// Comprehensive time tracking controller
class TimeTracker {
  constructor(apiUrl = 'http://localhost:8080') {
    this.apiUrl = apiUrl;
  }

  // Start time tracking with description
  async startTracking(taskId, description = null) {
    const endpoint = description 
      ? `/api/tasks/${encodeURIComponent(taskId)}/time/start-with-description`
      : `/api/tasks/${encodeURIComponent(taskId)}/time/start`;
    
    const body = description ? { description } : {};
    
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  // Stop time tracking
  async stopTracking(taskId) {
    const response = await fetch(`${this.apiUrl}/api/tasks/${encodeURIComponent(taskId)}/time/stop`, {
      method: 'POST'
    });
    return response.json();
  }

  // Get active sessions
  async getActiveSessions() {
    const response = await fetch(`${this.apiUrl}/api/time/active`);
    return response.json();
  }

  // Get task time data
  async getTaskTimeData(taskId) {
    const response = await fetch(`${this.apiUrl}/api/tasks/${encodeURIComponent(taskId)}/time`);
    return response.json();
  }

  // Get time summary
  async getTimeSummary(period = 'today', fromDate = null, toDate = null) {
    let url = `${this.apiUrl}/api/time/summary?period=${period}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;
    
    const response = await fetch(url);
    return response.json();
  }

  // Get daily dashboard data
  async getDashboard() {
    const [activeSessions, todaySummary, weekSummary] = await Promise.all([
      this.getActiveSessions(),
      this.getTimeSummary('today'),
      this.getTimeSummary('week')
    ]);

    return {
      active: activeSessions.data,
      today: todaySummary.data,
      week: weekSummary.data
    };
  }

  // Toggle time tracking for a task
  async toggleTracking(taskId, description = null) {
    const activeSessions = await this.getActiveSessions();
    const isCurrentlyTracking = activeSessions.data.activeSessions.some(
      session => session.task.id === taskId
    );

    if (isCurrentlyTracking) {
      return await this.stopTracking(taskId);
    } else {
      return await this.startTracking(taskId, description);
    }
  }
}

// Usage examples
const tracker = new TimeTracker();

// Start tracking with description
await tracker.startTracking('projects/api-work.md', 'Implementing time tracking endpoints');

// Get active sessions
const active = await tracker.getActiveSessions();
console.log(`Currently tracking ${active.data.totalActiveSessions} tasks`);

// Get today's summary
const today = await tracker.getTimeSummary('today');
console.log(`Today: ${today.data.summary.totalHours} hours across ${today.data.summary.tasksWithTime} tasks`);

// Get weekly breakdown
const week = await tracker.getTimeSummary('week');
console.log('Top projects this week:');
week.data.topProjects.forEach(project => {
  console.log(`- ${project.project}: ${Math.round(project.minutes / 60 * 100) / 100} hours`);
});

// Toggle tracking (start if stopped, stop if running)
await tracker.toggleTracking('projects/documentation.md', 'Writing API examples');

// Get comprehensive dashboard
const dashboard = await tracker.getDashboard();
console.log('Time Tracking Dashboard:', {
  activeNow: dashboard.active.totalActiveSessions,
  todayHours: dashboard.today.summary.totalHours,
  weekHours: dashboard.week.summary.totalHours,
  topTaskToday: dashboard.today.topTasks[0]?.title || 'None'
});
```

### Time Analytics Dashboard

```python
import requests
from datetime import datetime, timedelta
import json

class TimeAnalytics:
    def __init__(self, api_url='http://localhost:8080'):
        self.api_url = api_url
    
    def get_time_summary(self, period='today', from_date=None, to_date=None):
        params = {'period': period}
        if from_date:
            params['from'] = from_date
        if to_date:
            params['to'] = to_date
        
        response = requests.get(f'{self.api_url}/api/time/summary', params=params)
        return response.json()
    
    def generate_weekly_report(self):
        """Generate a comprehensive weekly time tracking report"""
        week_data = self.get_time_summary('week')
        
        if not week_data['success']:
            return None
        
        data = week_data['data']
        summary = data['summary']
        
        report = {
            'period': f"{data['dateRange']['from'][:10]} to {data['dateRange']['to'][:10]}",
            'total_hours': summary['totalHours'],
            'avg_hours_per_day': round(summary['totalHours'] / 7, 2),
            'tasks_worked_on': summary['tasksWithTime'],
            'productivity_score': min(100, round((summary['totalHours'] / 40) * 100, 1)),
            'top_focus_areas': {
                'projects': data['topProjects'][:3],
                'tags': data['topTags'][:3],
                'tasks': data['topTasks'][:5]
            }
        }
        
        return report
    
    def get_project_breakdown(self, days=30):
        """Get time breakdown by project for the last N days"""
        end_date = datetime.now().isoformat()[:10]
        start_date = (datetime.now() - timedelta(days=days)).isoformat()[:10]
        
        data = self.get_time_summary('custom', start_date, end_date)
        
        if data['success']:
            return {
                'period_days': days,
                'total_hours': data['data']['summary']['totalHours'],
                'projects': data['data']['topProjects']
            }
        return None

# Usage
analytics = TimeAnalytics()

# Weekly report
report = analytics.generate_weekly_report()
print(f"Weekly Report ({report['period']}):")
print(f"- Total: {report['total_hours']} hours")
print(f"- Daily average: {report['avg_hours_per_day']} hours")
print(f"- Productivity score: {report['productivity_score']}%")
print(f"- Top project: {report['top_focus_areas']['projects'][0]['project']}")

# Project breakdown
projects = analytics.get_project_breakdown(30)
print(f"\nLast 30 days project breakdown:")
for project in projects['projects']:
    percentage = round((project['minutes'] / (projects['total_hours'] * 60)) * 100, 1)
    print(f"- {project['project']}: {round(project['minutes']/60, 1)}h ({percentage}%)")
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

