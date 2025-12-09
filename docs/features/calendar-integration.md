# Calendar Integration

[← Back to Features](../features.md)

TaskNotes provides calendar integration through OAuth-connected calendar services, two Bases-powered calendar views, and read-only ICS calendar subscriptions.

## OAuth Calendar Integration

TaskNotes supports bidirectional synchronization with Google Calendar and Microsoft Outlook using OAuth authentication. This integration allows you to view external calendar events alongside your tasks and sync changes back to the calendar provider.

### Supported Providers

- **Google Calendar** - OAuth 2.0 authentication with access to all calendars in your Google account
- **Microsoft Outlook** - OAuth 2.0 authentication with access to calendars in your Microsoft 365 or Outlook.com account

### Setup Requirements

OAuth calendar integration requires creating an OAuth application with your calendar provider. This process takes approximately 15 minutes per provider. You will need to:

1. Create an OAuth application in Google Cloud Console or Microsoft Azure Portal
2. Configure redirect URIs and scopes
3. Obtain client ID and client secret
4. Enter credentials in TaskNotes settings (**Settings → TaskNotes → Integrations → OAuth Calendar Integration**)

### Synchronization Behavior

- Events are fetched automatically every 15 minutes
- Events are also fetched when local changes occur (task creation, updates, rescheduling)
- Dragging calendar events to new dates/times updates the event in the calendar provider
- Per-calendar visibility toggles allow selective display of calendars
- Access tokens are automatically refreshed when expired

### Token Management

TaskNotes stores OAuth access tokens and refresh tokens locally. Tokens are refreshed automatically before expiration. You can revoke access at any time through the integrations settings.

## Calendar Views

TaskNotes provides Calendar and Mini Calendar views that display tasks alongside OAuth calendar events and ICS subscriptions. Both views support drag-and-drop scheduling.

For detailed view documentation, see [Calendar Views](../views/calendar-views.md).

## Time Entry Editor

TaskNotes includes a time entry editor for tracking time spent on tasks. Time entries are created and managed through the Calendar View.

### Creating Time Entries

To create a time entry on the Calendar View:

1. Click and drag on a time slot in the calendar to select a time range
2. When the selection menu appears, choose **Create time entry** (timeblock appears only if the feature is enabled)
3. The time entry editor opens with start/end times pre-filled for the selected range

Time entries are associated with tasks and stored in the task's frontmatter. Multiple time entries can exist for a single task.

### Managing Time Entries

The time entry editor modal provides functions to:

- View all time entries for a task
- Edit the start time, end time, and duration of time entries
- Delete time entries
- See the total time tracked across all entries for a task

Access the time entry editor by clicking on an existing time entry in the calendar or through the task's context menu.

## ICS Calendar Subscriptions

TaskNotes can subscribe to external calendar feeds using the iCalendar (ICS) format. This provides read-only access to events from calendar services. ICS subscriptions differ from OAuth calendar integration in that they are read-only—dragging ICS events to new dates does not update the source calendar.

Add and manage ICS subscriptions from **Settings → TaskNotes → Integrations → Calendar subscriptions**.

For details on creating notes and tasks from calendar events, see [ICS Integration](ics-integration.md).

## Time Blocking

The Calendar View supports time blocking for scheduling dedicated work periods. To create a time block:

1. Click and drag on a time slot in the calendar to select a time range
2. A context menu will appear with available options
3. Select "Create timeblock" from the menu (this option only appears if timeblocking is enabled in settings)

Time blocks are stored in the frontmatter of daily notes and can be linked to specific tasks. This differs from time entries, which track actual time spent and are stored in task frontmatter rather than daily notes.

Enable time blocking under **Settings → TaskNotes → Features → Timeblocking**.
