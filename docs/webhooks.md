# TaskNotes Webhooks

TaskNotes webhooks enable real-time integrations by sending HTTP POST requests to your configured endpoints whenever specific events occur. This allows you to build automation, sync with external services, and create custom workflows.

## Quick Start

1. **Enable HTTP API** in TaskNotes Settings → Integrations → HTTP API
2. **Add a webhook** by clicking "Add Webhook" in the webhook settings
3. **Select events** you want to receive notifications for
4. **Configure transformation** (optional) for custom payload formats
5. **Test your integration** using the included test server or your endpoint

## Webhook Management Interface

TaskNotes provides a modern, intuitive interface for managing webhooks:

### Settings Interface

- **Card-based layout** - Each webhook displayed as a clean card with clear status indicators
- **Visual status indicators** - Active webhooks show green checkmarks, inactive show red X
- **Real-time statistics** - Success and failure counts with color-coded icons
- **Action buttons** - Enable/disable and delete webhooks with confirmation dialogs

### Adding Webhooks

The webhook creation modal provides:

- **Event selection** - Choose from all available events with descriptions
- **Transform configuration** - Optional JavaScript/JSON file specification
- **Headers control** - Toggle custom headers for strict CORS services
- **Validation** - Real-time URL and event validation

### Status Monitoring

Each webhook card displays:

- **Connection status** - Visual indicators for active/inactive state
- **Success metrics** - Green checkmark with success count
- **Failure metrics** - Red X with failure count  
- **Transform info** - Shows configured transformation file
- **CORS status** - Warning when custom headers are disabled

### Accessibility Features

The webhook interface is designed for accessibility:

- **Semantic icons** - Uses Obsidian's icon system instead of emoji characters
- **Descriptive labels** - Clear ARIA labels for screen readers
- **Keyboard navigation** - Full keyboard support for all interactions
- **High contrast** - Status indicators use color-coded backgrounds with icons
- **Tooltips** - Helpful hover text for all action buttons
- **Focus states** - Clear focus indicators for keyboard users

## Webhook Events

TaskNotes triggers webhooks for the following events:

### Task Events

- `task.created` - When a new task is created
- `task.updated` - When a task is modified
- `task.deleted` - When a task is removed
- `task.completed` - When a task status changes to completed
- `task.archived` - When a task is archived
- `task.unarchived` - When a task is unarchived

### Time Tracking Events  

- `time.started` - When time tracking starts on a task
- `time.stopped` - When time tracking stops on a task

### Pomodoro Events

- `pomodoro.started` - When a pomodoro session begins
- `pomodoro.completed` - When a pomodoro session finishes successfully
- `pomodoro.interrupted` - When a pomodoro session is interrupted

### Recurring Task Events

- `recurring.instance.completed` - When a recurring task instance is marked complete

### Reminder Events

- `reminder.triggered` - When a task reminder fires and displays a notification

## Payload Structure

All webhook payloads follow this structure:

```json
{
  "event": "task.created",
  "timestamp": "2024-03-15T14:30:00.000Z",
  "vault": {
    "name": "My Vault",
    "path": "/Users/username/Documents/MyVault"
  },
  "data": {
    "task": {
      "id": "path/to/task.md",
      "title": "Review PR #123",
      "status": "todo",
      "priority": "high",
      "due": "2024-03-16",
      "scheduled": null,
      "path": "path/to/task.md",
      "archived": false,
      "tags": ["123"],
      "contexts": ["work"],
      "projects": ["[[Project Name]]"],
      "timeEstimate": 60
    }
  }
}
```

## Event-Specific Payloads

### Task Created/Updated/Deleted

```json
{
  "event": "task.created",
  "data": {
    "task": { /* TaskInfo object */ }
  }
}
```

### Task Updated (includes previous state)

```json
{
  "event": "task.updated", 
  "data": {
    "task": { /* Current TaskInfo */ },
    "previous": { /* Previous TaskInfo */ }
  }
}
```

### Time Tracking Events

```json
{
  "event": "time.started",
  "data": {
    "task": { /* TaskInfo object */ },
    "session": {
      "startTime": "2024-03-15T14:30:00.000Z",
      "endTime": null,
      "description": null
    }
  }
}
```

### NLP Task Creation

```json
{
  "event": "task.created",
  "data": {
    "task": { /* TaskInfo object */ },
    "source": "nlp",
    "originalText": "Review PR #123 tomorrow high priority @work"
  }
}
```

### Reminder Events

```json
{
  "event": "reminder.triggered",
  "data": {
    "task": { /* TaskInfo object */ },
    "reminder": {
      "id": "rem_1234",
      "type": "relative",
      "relatedTo": "due",
      "offset": "-PT15M",
      "description": "Don't forget this important task!"
    },
    "notificationTime": "2024-03-15T14:15:00.000Z",
    "message": "Don't forget this important task!",
    "notificationType": "system"
  }
}
```

## Security

### Webhook Signatures

TaskNotes signs all webhook payloads using HMAC-SHA256. Verify signatures to ensure authenticity:

**Headers:**

- `X-TaskNotes-Event`: Event type (e.g., "task.created")
- `X-TaskNotes-Signature`: HMAC signature (hex-encoded)
- `X-TaskNotes-Delivery-ID`: Unique delivery ID

**Verification (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  return signature === expectedSignature;
}

// Express.js example
app.post('/webhook', express.json(), (req, res) => {
  const signature = req.headers['x-tasknotes-signature'];
  const isValid = verifyWebhook(req.body, signature, process.env.WEBHOOK_SECRET);
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook...
  console.log('Event:', req.body.event);
  res.status(200).send('OK');
});
```

**Verification (Python):**

```python
import hmac
import hashlib
import json

def verify_webhook(payload, signature, secret):
    expected = hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature == expected

# Flask example  
from flask import Flask, request

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-TaskNotes-Signature')
    if not verify_webhook(request.json, signature, WEBHOOK_SECRET):
        return 'Invalid signature', 401
        
    event = request.json['event']
    # Process webhook...
    return 'OK'
```

## Integration Examples

### Todoist Sync

```javascript
app.post('/webhook/tasknotes', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'task.created') {
    // Create task in Todoist
    await todoist.createTask({
      content: data.task.title,
      due_date: data.task.due,
      priority: mapPriority(data.task.priority),
      project_id: getProjectId(data.task.projects[0])
    });
  }
  
  res.status(200).send('OK');
});
```

### Slack Notifications

```javascript
app.post('/webhook/tasknotes', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'task.completed') {
    slack.chat.postMessage({
      channel: '#productivity',
      text: `✅ Task completed: ${data.task.title}`
    });
  }
  
  res.status(200).send('OK');
});
```

### Time Tracking Integration

```javascript
app.post('/webhook/tasknotes', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'time.started') {
    // Start timer in external service
    await toggl.startTimer({
      description: data.task.title,
      project: data.task.projects[0]
    });
  } else if (event === 'time.stopped') {
    await toggl.stopTimer();
  }
  
  res.status(200).send('OK');
});
```

### Reminder Notifications

```javascript
app.post('/webhook/tasknotes', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'reminder.triggered') {
    // Forward reminder to mobile app via push notification
    await pushNotification.send({
      title: 'TaskNotes Reminder',
      body: data.message,
      data: {
        taskId: data.task.id,
        taskTitle: data.task.title,
        reminderType: data.reminder.type
      }
    });
    
    // Or send to smart home system
    await homeAssistant.notify({
      message: data.message,
      service: 'mobile_app_phone'
    });
  }
  
  res.status(200).send('OK');
});
```

### Analytics Dashboard

```javascript
app.post('/webhook/tasknotes', (req, res) => {
  const { event, data, vault } = req.body;
  
  // Store event in database
  await db.events.create({
    vault_name: vault.name,
    event_type: event,
    task_id: data.task?.id,
    timestamp: new Date(),
    metadata: data
  });
  
  // Emit to real-time dashboard
  io.emit('task-update', { event, data });
  
  res.status(200).send('OK');
});
```

## Webhook Management

### Register Webhook (via API)

```bash
curl -X POST http://localhost:8080/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "url": "https://your-service.com/webhook",
    "events": ["task.created", "task.completed"]
  }'
```

### List Webhooks

```bash
curl http://localhost:8080/api/webhooks \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### Delete Webhook  

```bash
curl -X DELETE http://localhost:8080/api/webhooks/WEBHOOK_ID \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### View Delivery History

```bash
curl http://localhost:8080/api/webhooks/deliveries \
  -H "Authorization: Bearer YOUR_API_TOKEN"  
```

## Reliability Features

### Automatic Retries

- Failed deliveries retry 3 times with exponential backoff (1s, 2s, 4s)
- Webhooks automatically disabled after 10+ consecutive failures

### Delivery Tracking

- Each delivery gets a unique ID for tracking
- Success/failure counts maintained per webhook
- Recent delivery history available via API

### Error Handling

- 10-second timeout per delivery attempt  
- HTTP status codes tracked for debugging
- Failed webhooks don't block TaskNotes operations

## Payload Transformations

### Transform Files

TaskNotes supports custom payload transformations using JavaScript or JSON template files stored in your vault. This allows you to adapt webhook payloads to match the specific format required by different services (Discord, Slack, custom APIs, etc.).

📁 **[View Transform Examples](examples/webhook-transforms/)** - Ready-to-use transform files for Discord, Slack, Teams, and more!

#### How Transform Files Work

1. **File Location**: Transform files must be stored in your Obsidian vault
2. **File Types**: Supports `.js` (JavaScript) and `.json` (JSON template) files
3. **Execution**: Files are read and executed when a webhook is triggered
4. **Safety**: JavaScript files run in a controlled context for security
5. **Error Handling**: Failed transformations fall back to original payload

#### JavaScript Transformations

JavaScript files provide maximum flexibility for complex transformations. The file must define a `transform` function that receives the webhook payload and returns the transformed data.

**Basic Structure:**
```javascript
function transform(payload) {
  // Your transformation logic here
  return transformedPayload;
}
```

**Complete Discord Example:**
```javascript
// discord-webhook.js - Transform for Discord webhook format
function transform(payload) {
  const { event, data, timestamp, vault } = payload;
  
  // Handle different event types
  if (event === 'task.completed') {
    return {
      embeds: [{
        title: "✅ Task Completed",
        description: data.task.title,
        color: 5763719, // Green color
        fields: [
          {
            name: "Priority",
            value: data.task.priority || "Normal",
            inline: true
          },
          {
            name: "Project", 
            value: data.task.projects?.[0] || "None",
            inline: true
          },
          {
            name: "Due Date",
            value: data.task.due || "Not set",
            inline: true
          }
        ],
        footer: {
          text: `From ${vault.name}`,
          icon_url: "https://obsidian.md/favicon.ico"
        },
        timestamp: timestamp
      }]
    };
  } else if (event === 'task.created') {
    return {
      embeds: [{
        title: "📝 New Task Created",
        description: data.task.title,
        color: 3447003, // Blue color
        fields: [
          {
            name: "Status",
            value: data.task.status,
            inline: true
          },
          {
            name: "Priority",
            value: data.task.priority || "Normal",
            inline: true
          }
        ],
        timestamp: timestamp
      }]
    };
  } else if (event === 'pomodoro.completed') {
    return {
      embeds: [{
        title: "🍅 Pomodoro Completed",
        description: `Finished working on: ${data.task.title}`,
        color: 15158332, // Red color
        timestamp: timestamp
      }]
    };
  }
  
  // For unhandled events, return a generic message
  return {
    content: `TaskNotes: ${event} event triggered`
  };
}
```

**Slack Example:**
```javascript
// slack-webhook.js - Transform for Slack webhook format  
function transform(payload) {
  const { event, data, vault } = payload;
  
  if (event === 'task.completed') {
    return {
      text: `Task completed: ${data.task.title}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn", 
            text: `✅ *Task Completed*\n${data.task.title}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Priority: ${data.task.priority || 'Normal'} | Vault: ${vault.name}`
            }
          ]
        }
      ]
    };
  }
  
  return {
    text: `TaskNotes: ${event} in ${vault.name}`
  };
}
```

#### JSON Templates

JSON templates provide a simpler way to transform payloads using variable substitution. Templates can define different formats for different events.

**Template Structure:**
```json
{
  "event-name": { /* Template for specific event */ },
  "default": { /* Fallback template for all other events */ }
}
```

**Variable Syntax:**
- Use `${path.to.value}` to insert values from the payload
- Supports nested object access (e.g., `${data.task.title}`)
- Variables that don't exist remain as literal text

**Slack Template Example:**
```json
{
  "task.completed": {
    "text": "Task completed: ${data.task.title}",
    "channel": "#tasks",
    "username": "TaskNotes",
    "icon_emoji": ":white_check_mark:",
    "attachments": [
      {
        "color": "good",
        "fields": [
          {
            "title": "Priority",
            "value": "${data.task.priority}",
            "short": true
          },
          {
            "title": "Project",
            "value": "${data.task.projects.0}",
            "short": true
          }
        ]
      }
    ]
  },
  "task.created": {
    "text": "New task: ${data.task.title}",
    "channel": "#tasks",
    "username": "TaskNotes",
    "icon_emoji": ":memo:"
  },
  "default": {
    "text": "TaskNotes event: ${event}",
    "channel": "#general",
    "username": "TaskNotes"
  }
}
```

**Teams Template Example:**
```json
{
  "task.completed": {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "28a745",
    "summary": "Task Completed",
    "sections": [
      {
        "activityTitle": "✅ Task Completed",
        "activitySubtitle": "${data.task.title}",
        "facts": [
          {
            "name": "Priority:",
            "value": "${data.task.priority}"
          },
          {
            "name": "Vault:",
            "value": "${vault.name}"
          }
        ]
      }
    ]
  },
  "default": {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "summary": "TaskNotes Event",
    "text": "Event ${event} triggered in ${vault.name}"
  }
}
```

#### Advanced JavaScript Examples

**Conditional Logic:**
```javascript
function transform(payload) {
  const { event, data } = payload;
  
  // Only process high priority tasks
  if (data.task && data.task.priority !== 'high') {
    return null; // Return null to skip webhook delivery
  }
  
  // Custom logic based on task properties
  if (data.task.tags && data.task.tags.includes('urgent')) {
    return {
      priority: "high",
      message: `🚨 URGENT: ${data.task.title}`,
      event: event
    };
  }
  
  return payload; // Return original
}
```

**Data Enrichment:**
```javascript
function transform(payload) {
  const { event, data } = payload;
  
  // Add computed fields
  const enrichedPayload = {
    ...payload,
    computed: {
      isOverdue: data.task.due && new Date(data.task.due) < new Date(),
      hasProject: data.task.projects && data.task.projects.length > 0,
      estimatedMinutes: data.task.timeEstimate || 0,
      daysSinceDue: data.task.due ? 
        Math.floor((new Date() - new Date(data.task.due)) / (1000 * 60 * 60 * 24)) : null
    }
  };
  
  return enrichedPayload;
}
```

**Multi-Service Routing:**
```javascript
function transform(payload) {
  const { event, data } = payload;
  
  // Return array to send to multiple endpoints
  const results = [];
  
  // Always log to analytics service
  results.push({
    service: "analytics",
    event: event,
    task_id: data.task.id,
    timestamp: new Date().toISOString()
  });
  
  // Send high priority tasks to alert channel
  if (data.task.priority === 'high') {
    results.push({
      service: "alerts",
      text: `High priority task: ${data.task.title}`,
      urgency: "high"
    });
  }
  
  return results;
}
```

#### Security Considerations

- **Sandboxed Execution**: JavaScript files run in a controlled context
- **No Node.js APIs**: Transform functions cannot access file system, network, or other Node.js APIs
- **Error Isolation**: Transform errors don't affect TaskNotes or other webhooks
- **Input Validation**: Always validate payload structure in your transform function

#### Debugging Transform Files

**Console Logging:**
Transform functions cannot use `console.log()`, but you can return debug information:

```javascript
function transform(payload) {
  try {
    // Your transformation logic
    const result = { /* transformed data */ };
    
    return {
      ...result,
      _debug: {
        originalEvent: payload.event,
        transformedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    // Return error info in payload for debugging
    return {
      error: error.message,
      originalPayload: payload
    };
  }
}
```

**Testing Strategy:**
1. Start with a simple transform that returns the original payload
2. Add small changes incrementally
3. Use webhook.site or the built-in test server to inspect outputs
4. Check TaskNotes console for transformation errors

### Headers Configuration

TaskNotes includes custom headers by default:

- `X-TaskNotes-Event`: Event type
- `X-TaskNotes-Signature`: HMAC signature  
- `X-TaskNotes-Delivery-ID`: Unique delivery ID

For services with strict CORS policies (Discord, Slack), disable custom headers in webhook settings.

## Testing Webhooks

### Built-in Test Server

TaskNotes includes a comprehensive test server for webhook development:

```bash
# Navigate to TaskNotes directory
node test-webhook.js

# Or specify custom port
node test-webhook.js 8080
```

The test server provides:

- **Real-time payload inspection** with formatted output
- **Signature verification** using configurable test secret
- **Event-specific processing** with detailed logging
- **CORS support** for browser-based testing
- **Health check endpoint** at `/health`

#### Configuration

Use the test secret when adding the webhook:

```
URL: http://localhost:3000/webhook
Secret: test-secret-key-for-tasknotes-webhooks
```

### Local Testing with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL in webhook settings
# https://abc123.ngrok.io/webhook
```

### Webhook Testing Service

Use services like [webhook.site](https://webhook.site) for quick testing:

1. Go to webhook.site and copy your unique URL
2. Add it as a webhook in TaskNotes  
3. Perform actions to trigger events
4. View payloads in real-time on webhook.site

## Best Practices

### Security

- Always verify webhook signatures
- Use HTTPS endpoints in production  
- Store webhook secrets securely
- Validate payload structure before processing

### Performance

- Process webhooks asynchronously 
- Return 200 status quickly to avoid retries
- Use queuing for heavy processing
- Implement idempotency using delivery IDs

### Reliability  

- Handle duplicate deliveries gracefully
- Log webhook events for debugging
- Monitor webhook failures
- Set up alerts for disabled webhooks

### Integration

- Subscribe only to needed events
- Filter events in your handler
- Batch related operations when possible
- Use webhook data to trigger workflows, not as primary data source

## Troubleshooting

### Common Issues

**Webhook not triggered:**

- Verify webhook is active in settings
- Check event subscription includes the triggered event
- Ensure HTTP API is enabled and running

**Signature verification fails:**

- Confirm secret matches webhook configuration
- Check payload serialization (use exact JSON string)
- Verify HMAC calculation implementation

**Timeouts:**

- Optimize endpoint response time
- Return 200 status before heavy processing  
- Use async processing for complex operations

**High failure count:**

- Check endpoint availability
- Verify URL and network connectivity
- Review server logs for error details

### Debug Mode

Enable debug logging by setting webhook events to verbose:

```javascript
// In your webhook handler
console.log('Headers:', req.headers);
console.log('Body:', req.body); 
console.log('Signature verification:', isValidSignature);
```

### Monitoring and Debugging

The improved webhook interface provides better debugging tools:

- **Visual status indicators** - Quickly identify inactive or failing webhooks
- **Success/failure counts** - Monitor webhook health at a glance  
- **Card-based layout** - Easy scanning of multiple webhook configurations
- **Transform file status** - Clear indication when payload transformations are active
- **CORS warnings** - Visual alerts when custom headers are disabled

### Support

For webhook-related issues:
1. Check webhook status indicators in the settings interface
2. Monitor success/failure counts for each webhook
3. Verify endpoint accessibility with the built-in test server
4. Test with webhook.site for quick validation  
5. Review TaskNotes console logs for detailed error information
6. Use the included test server for local development and debugging
