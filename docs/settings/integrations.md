# Integrations Settings

These settings control the integration with other plugins and services, such as Bases and external calendars.

[← Back to Settings](../settings.md)

![Integrations Settings](../assets/settings-integrations.png)

## Bases Integration

TaskNotes v4 uses Obsidian's Bases core plugin for its main views. For setup instructions, see [Core Concepts](../core-concepts.md#bases-integration).

### View Commands Configuration

Configure which `.base` files are opened by TaskNotes view commands and ribbon icons. These settings allow you to customize which files open when you use familiar TaskNotes shortcuts.

Access these settings in **Settings → TaskNotes → General → View Commands**.

Available command mappings:
- **Open Mini Calendar View**: Default opens `TaskNotes/Views/mini-calendar-default.base`
- **Open Kanban View**: Default opens `TaskNotes/Views/kanban-default.base`
- **Open Tasks View**: Default opens `TaskNotes/Views/tasks-default.base`
- **Open Calendar View**: Default opens `TaskNotes/Views/calendar-default.base`
- **Open Agenda View**: Default opens `TaskNotes/Views/agenda-default.base`
- **Relationships Widget**: Default opens `TaskNotes/Views/relationships.base`

Each command allows you to specify a custom `.base` file path and includes a reset button to restore the default path.

**Create Default Files**: Button to generate all default `.base` files in the `TaskNotes/Views/` directory. Existing files are not overwritten.

## OAuth Calendar Integration

Connect Google Calendar or Microsoft Outlook to sync events bidirectionally with TaskNotes. Events automatically refresh every 15 minutes and sync when local changes are made (such as dragging events to reschedule).

### Setup Requirements

OAuth integration requires creating your own OAuth application with Google and/or Microsoft. Initial setup takes approximately 15 minutes per provider.

**Setup Guide**: See [Calendar Integration Setup](../calendar-setup.md) for detailed instructions on creating OAuth credentials with Google Cloud Console and Azure Portal.

### Google Calendar

- **Client ID**: OAuth 2.0 Client ID from Google Cloud Console
- **Client Secret**: OAuth 2.0 Client Secret from Google Cloud Console
- **Connect Google Calendar**: Button to authenticate via OAuth 2.0 loopback flow
- **Disconnect**: Revokes access and removes stored credentials

When connected, displays:
- Connected account email
- Connection time
- Last sync time
- Manual refresh button

### Microsoft Outlook Calendar

- **Client ID**: Application (client) ID from Azure Portal
- **Client Secret**: Client secret from Azure Portal
- **Connect Microsoft Calendar**: Button to authenticate via OAuth 2.0
- **Disconnect**: Revokes access and removes stored credentials

When connected, displays:
- Connected account email
- Connection time
- Last sync time

### Security

- OAuth credentials are stored locally in Obsidian's data folder
- Access tokens refresh automatically
- Calendar data syncs directly between Obsidian and the calendar provider (no intermediary servers)
- Disconnect at any time to revoke access

## Calendar subscriptions (ICS)

- **Default note template**: Path to template file for notes created from ICS events.
- **Default note folder**: Folder for notes created from ICS events. Supports template variables (e.g., `Daily/{{year}}/{{month}}/{{day}}`, `Events/{{icsEventTitle}}`). See ICS Integration documentation for full list of supported variables.
- **ICS note filename format**: How filenames are generated for notes created from ICS events.
- **Custom ICS filename template**: Template for custom ICS event filenames.
- **Add Calendar Subscription**: Add a new calendar subscription from ICS/iCal URL or local file.
- **Refresh all subscriptions**: Manually refresh all enabled calendar subscriptions.

## Automatic ICS export

- **Enable automatic export**: Automatically keep an ICS file updated with all your tasks.
- **Export file path**: Path where the ICS file will be saved (relative to vault root).
- **Update interval (between 5 and 1440 minutes)**: How often to update the export file.
- **Export now**: Manually trigger an immediate export.

## HTTP API

- **Enable HTTP API**: Start local HTTP server for API access.
- **API port**: Port number for the HTTP API server.
- **API authentication token**: Token required for API authentication (leave empty for no auth).

Changes to API enablement or port require an Obsidian restart to take effect.

!!! warning
    If the authentication token is empty, API requests are unauthenticated. Set a token unless your environment is fully trusted.

## Webhooks

- **Add Webhook**: Register a new webhook endpoint.
