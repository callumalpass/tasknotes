# TaskNotes Webhooks

TaskNotes webhooks enable real-time integrations by sending HTTP POST requests to your configured endpoints whenever specific events occur. This allows you to build automation, sync with external services, and create custom workflows.

## Quick Start

1. **Enable HTTP API** in TaskNotes Settings → HTTP API tab
2. **Add a webhook** by clicking "Add Webhook" in the webhook settings
3. **Configure your endpoint** to receive and process webhook payloads
4. **Test your integration** by performing actions in TaskNotes

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

## Testing Webhooks

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

### Example Test Server

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('=== TaskNotes Webhook ===');
  console.log('Event:', req.headers['x-tasknotes-event']);
  console.log('Delivery ID:', req.headers['x-tasknotes-delivery-id']);
  console.log('Payload:', JSON.stringify(req.body, null, 2));
  console.log('========================');
  
  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Webhook test server running on port 3000');
});
```

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

### Support

For webhook-related issues:
1. Check TaskNotes console logs
2. Verify endpoint accessibility  
3. Test with webhook.site first
4. Review delivery history in settings
