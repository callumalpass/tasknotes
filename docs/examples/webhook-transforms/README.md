# TaskNotes Webhook Transform Examples

This directory contains example transform files that demonstrate how to customize webhook payloads for different services and formats. Transform files allow you to modify the structure and content of webhook payloads before they're sent to your endpoints.

## What are Transform Files?

Transform files let you customize webhook payloads to match the specific format required by different services like Discord, Slack, Microsoft Teams, or custom APIs. TaskNotes supports two types of transform files:

- **JavaScript files (`.js`)** - Maximum flexibility with custom logic
- **JSON templates (`.json`)** - Simple variable substitution

## Available Examples

### JavaScript Transforms

#### `discord-webhook.js`
Transforms TaskNotes webhooks into Discord-compatible embeds with:
- Rich embed formatting with colors and emojis
- Event-specific styling and information
- Support for all TaskNotes webhook events including the new `recurring.instance.completed` event
- Comprehensive error handling and fallback content

**Usage:** Copy to your vault and specify the file path in your webhook configuration.

#### `slack-webhook.js`
Formats webhooks for Slack with:
- Slack-compatible message formatting
- Attachment-based layouts with color coding
- Emoji reactions using Slack emoji syntax
- Timestamp formatting for Slack

**Usage:** Copy to your vault and configure your webhook to use this transform.

### JSON Templates

#### `simple-template.json`
A basic JSON template showing variable substitution:
- Simple message formatting
- All webhook events covered
- Shows how to access nested payload properties
- Good starting point for custom JSON APIs

#### `teams-webhook.json`
Microsoft Teams connector card format:
- MessageCard format for Teams webhooks
- Color-coded cards by event type
- Structured facts display
- Schema.org compliance

## How to Use Transform Files

### 1. Copy to Your Vault
Copy any example file to your Obsidian vault. You can place them anywhere, but consider creating a dedicated folder like `webhooks/transforms/`.

### 2. Configure Webhook
When adding or editing a webhook in TaskNotes settings:
1. Enter your webhook URL
2. Select the events you want to receive
3. In the "Transform File" field, enter the path to your transform file (e.g., `webhooks/transforms/discord-webhook.js`)
4. Save the webhook

### 3. Test Your Integration
Use the built-in test server or a service like webhook.site to verify your transform is working correctly.

## Creating Custom Transform Files

### JavaScript Transforms

JavaScript transforms give you maximum flexibility. Your file must export a `transform` function:

```javascript
function transform(payload) {
  const { event, data, timestamp, vault } = payload;
  
  // Your custom logic here
  
  return transformedPayload;
}
```

#### Available Payload Properties
- `event` - The webhook event type (e.g., 'task.completed')
- `data` - Event-specific data (task info, session data, etc.)
- `timestamp` - ISO timestamp of when the event occurred
- `vault` - Information about the Obsidian vault

#### JavaScript Features
- Full JavaScript syntax support
- Conditional logic and loops
- Data transformation and enrichment
- Error handling with try/catch
- Return `null` to skip webhook delivery

#### Security Notes
- JavaScript transforms run in a sandboxed environment
- No access to Node.js APIs, file system, or network
- No `console.log()` available (use return values for debugging)

### JSON Templates

JSON templates use simple variable substitution with `${path.to.value}` syntax:

```json
{
  "event-name": {
    "message": "Task completed: ${data.task.title}",
    "priority": "${data.task.priority}",
    "vault": "${vault.name}"
  },
  "default": {
    "message": "Event ${event} occurred"
  }
}
```

#### Template Structure
- Define templates for specific events using the event name as the key
- Use `"default"` for a fallback template
- Variables that don't exist remain as literal text

#### Variable Access
- `${event}` - Event type
- `${timestamp}` - Event timestamp
- `${vault.name}` - Vault name
- `${data.task.title}` - Task title (for task events)
- `${data.task.priority}` - Task priority
- `${data.task.status}` - Task status
- `${data.date}` - Instance date (for recurring task completion)

## Webhook Events Reference

### Task Events
- `task.created` - New task created
- `task.updated` - Task modified (includes `data.previous` with old values)
- `task.completed` - Task marked as complete
- `task.deleted` - Task removed
- `task.archived` - Task archived
- `task.unarchived` - Task unarchived

### Time Tracking Events
- `time.started` - Time tracking started
- `time.stopped` - Time tracking stopped

### Pomodoro Events
- `pomodoro.started` - Pomodoro session began
- `pomodoro.completed` - Pomodoro session finished
- `pomodoro.interrupted` - Pomodoro session interrupted

### Recurring Task Events
- `recurring.instance.completed` - Recurring task instance marked complete

### Reminder Events
- `reminder.triggered` - Task reminder fired

## Debugging Transform Files

### Testing Strategies
1. Start with a simple transform that returns the original payload
2. Add small changes incrementally
3. Use webhook.site or the built-in test server to inspect outputs
4. Check TaskNotes console for transformation errors

### Common Issues
- **Syntax errors:** Validate JavaScript syntax and JSON format
- **Missing variables:** Check that accessed properties exist in the payload
- **Transform not applied:** Verify file path is correct and accessible
- **Webhook failures:** Check endpoint compatibility with transformed payload

### Debug Information
Add debug information to your transform output:

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
    return {
      error: error.message,
      originalPayload: payload
    };
  }
}
```

## Service-Specific Tips

### Discord
- Use embeds for rich formatting
- Colors should be hex values (e.g., `0xFF0000`)
- Disable custom headers in webhook settings for Discord compatibility
- Maximum embed description: 4096 characters

### Slack
- Use attachments for structured content
- Colors can be 'good', 'warning', 'danger', or hex values
- Timestamp should be Unix timestamp
- Use Slack emoji syntax (`:emoji_name:`)

### Microsoft Teams
- Use MessageCard format for connector webhooks
- Include `@type` and `@context` properties
- Colors should be hex values without leading '#'
- Facts array for key-value pairs

### Custom APIs
- Check your API documentation for required fields
- Consider rate limiting and authentication requirements
- Use appropriate HTTP methods and content types
- Handle webhook delivery failures gracefully

## Best Practices

1. **Keep transforms simple** - Complex logic can slow webhook delivery
2. **Handle missing data** - Use fallbacks for optional fields
3. **Test thoroughly** - Verify transforms work with all event types
4. **Document custom fields** - Add comments explaining your logic
5. **Version control** - Keep transforms in your vault for backup
6. **Monitor failures** - Check webhook success/failure counts regularly

## Contributing

Found a bug in an example or have a new service integration? Contributions are welcome! Please ensure your examples:
- Handle all webhook events appropriately
- Include proper error handling
- Are well-commented and documented
- Follow the established patterns in existing examples