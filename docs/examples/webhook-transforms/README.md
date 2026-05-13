# TaskNotes Webhook Transform Examples

This directory contains JSON transform templates for customizing webhook payloads before TaskNotes sends them to an endpoint.

## What Are Transform Files?

Transform files let you reshape webhook payloads for services like Slack, Microsoft Teams, or custom APIs. TaskNotes supports JSON templates (`.json`) with variable substitution.

JavaScript transform files (`.js`) are no longer supported.

## Available Examples

### `simple-template.json`

A basic JSON template showing variable substitution:
- Simple message formatting
- All webhook events covered
- Nested payload values such as `${data.task.title}`
- A useful starting point for custom JSON APIs

### `minimal-slack.json`

A small Slack-compatible example:
- Sends a text payload
- Uses event-specific templates for task creation and completion
- Includes a default fallback payload

### `teams-webhook.json`

Microsoft Teams connector card format:
- MessageCard format for Teams webhooks
- Color-coded cards by event type
- Structured facts display
- Schema.org compliance

## How To Use Transform Files

1. Copy an example JSON file to your Obsidian vault. A dedicated folder such as `webhooks/transforms/` keeps these templates organized.
2. Add or edit a webhook in TaskNotes settings.
3. Enter the webhook URL and select the events you want to receive.
4. In the "Transform File" field, enter the path to the JSON template, for example `webhooks/transforms/simple-template.json`.
5. Save the webhook.

Use the built-in test server or a service like webhook.site to verify the payload shape.

## Creating Custom JSON Templates

JSON templates use `${path.to.value}` variable substitution:

```json
{
  "task.completed": {
    "message": "Task completed: ${data.task.title}",
    "priority": "${data.task.priority}",
    "vault": "${vault.name}"
  },
  "default": {
    "message": "Event ${event} occurred"
  }
}
```

Template keys match webhook event names. The `default` key is used when an event-specific template is not present. Missing variables remain as literal text.
