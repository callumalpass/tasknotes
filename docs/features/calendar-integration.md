# Calendar Integration

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
4. Enter credentials in TaskNotes settings (`Settings -> TaskNotes -> Integrations`, OAuth calendar section)

### Synchronization Behavior

- Events are fetched automatically every 15 minutes
- Events are also fetched when local changes occur (task creation, updates, rescheduling)
- Dragging calendar events to new dates/times updates the event in the calendar provider
- Per-calendar visibility toggles allow selective display of calendars
- Access tokens are automatically refreshed when expired
- Globally disabled calendars are excluded from the combined event data, not just hidden in a view
- Connecting Microsoft starts an initial fetch and automatic refresh; disconnecting removes its cached calendars, events, and sync state
- Google manual refresh reports calendar fetch failures, including partial failures. Successful calendars still update, while failed calendars retain their previous data; failed refreshes can be retried immediately

### Google Calendar Task Availability

Under **Settings → TaskNotes → Integrations → Export tasks to Google Calendar**, enable **Show all-day task events as free** to prevent all-day task exports from blocking your availability. This includes date-only tasks and timed tasks converted by **Create as all-day events**. Timed exports remain Busy.

The option is off by default. Changes apply when tasks are exported or updated. Run **Sync all tasks** to update existing eligible task events. Disabling the option makes exported task events Busy again on their next full sync. This setting does not affect unrelated calendar events.

### Token Management

TaskNotes stores OAuth client credentials, access tokens, and refresh tokens in Obsidian Secret Storage, which is encrypted at rest when supported by the operating system and kept separate from TaskNotes' `data.json`. Tokens are refreshed automatically before expiration. You can revoke account access or forget the saved OAuth app credentials through the integrations settings.

## Calendar Views

TaskNotes provides Calendar and Mini Calendar views that display tasks alongside OAuth calendar events and ICS subscriptions. Both views support drag-and-drop scheduling.

For detailed view documentation, see [Calendar Views](../views/calendar-views.md).

Notes linked from recurring external calendar events can be matched either across the loaded event series or only to the selected recurrence instance. Configure this in [Integrations settings](../settings/integrations.md#calendar-subscriptions-ics).

## Time Entry Editor

TaskNotes includes a time entry editor for tracking time spent on tasks. Time entries are created and managed through the Calendar View.

### Creating Time Entries

To create a time entry on the Calendar View:

1. Click and drag on a time slot in the calendar to select a time range
2. When the selection menu appears, choose **Create time entry** (timeblock appears only if the feature is enabled)
3. Choose a task in the task selector modal
4. A time entry is created for that task with the selected start/end range

Time entries are always associated with a specific task and stored in that task's frontmatter. Multiple time entries can exist for one task.

### Managing Time Entries

The time entry editor modal provides functions to:

- View all time entries for a task
- Edit the start time, end time, and duration of time entries
- Delete time entries
- See the total time tracked across all entries for a task

Access the time entry editor by clicking an existing time entry in the calendar.

## ICS Calendar Subscriptions

TaskNotes can subscribe to external calendar feeds using the iCalendar (ICS) format. This provides read-only access to events from calendar services. ICS subscriptions differ from OAuth calendar integration in that they are read-only—dragging ICS events to new dates does not update the source calendar.

Add and manage ICS subscriptions from `Settings -> TaskNotes -> Integrations` (Calendar Subscriptions section).

### Private feeds (username and password)

Some servers, such as Nextcloud, Baïkal, Davis and Radicale, only serve private calendars to signed-in users. For these feeds, set **Authentication** to **Username and password (HTTP Basic)** on the subscription card and enter your credentials. Use the server's ICS export URL (for Nextcloud, Baïkal and Davis this usually ends in `?export`). An app-specific password is recommended where the server supports one.

- Authenticated feeds must use an `https://` URL. TaskNotes refuses to send credentials over plain `http://` or `webcal://` and shows an error instead.
- The username is saved with the subscription settings. The password is stored in Obsidian Secret Storage, not in TaskNotes' `data.json`, so it is not synced with your settings and must be entered on each device. If Secret Storage is unavailable, the password cannot be saved.
- The password field never shows the saved password. Enter a new one to replace it. Switching **Authentication** back to **None** or deleting the subscription removes the saved password.
- If the server rejects the credentials (HTTP 401 or 403), TaskNotes shows an authentication error for that calendar.

Recurring subscriptions load a bounded window from 30 days ago through one year ahead, with at most 3,000 retained instances per series. Historical occurrences do not consume that visible-instance limit. Non-recurring events are not affected by this window.

Google recurring-task exports include completion, skip, and moved-original exclusions only when those dates belong to the exported recurrence. All-day exports use their date-only start when validating exclusions.

Cancelled events are hidden. A guest declining an invitation does not hide the meeting. When a feed's `X-WR-CALNAME` is an email address (as in many personal Google Calendar feeds), TaskNotes matches that address to the owner's `ATTENDEE` response and hides meetings they declined. Recurring exceptions can override the series response. If the feed does not identify the owner, TaskNotes keeps events visible rather than guessing whose response applies. This does not use the subscription's display name. Refresh the subscription after updating to restore previously hidden meetings.

For details on creating notes and tasks from calendar events, see [ICS Integration](ics-integration.md).

## Time Blocking

The Calendar View supports time blocking for scheduling dedicated work periods. To create a time block:

1. Click and drag on a time slot in the calendar to select a time range
2. A context menu will appear with available options
3. Select "Create timeblock" from the menu (this option only appears if timeblocking is enabled in settings)

Time blocks are stored in the frontmatter of daily notes and can be linked to specific tasks. This differs from time entries, which track actual time spent and are stored in task frontmatter rather than daily notes.

Enable time blocking under `Settings -> TaskNotes -> Features` (Timeblocking section).

### Syncing Timeblocks to Google Calendar

TaskNotes can create Google Calendar events for your timeblocks. This is off by default. Under **Settings → TaskNotes → Integrations → Export timeblocks to Google Calendar**:

- **Sync timeblocks** turns syncing on. It works independently of **Enable task export**, but Google Calendar must be connected.
- **Timeblock calendar** chooses the calendar for timeblock events. Leave it on **Same as task calendar** to use the task export target calendar.
- **Timeblock event title template** sets event titles separately from task events. It supports `{{title}}`, `{{date}}`, `{{startTime}}` and `{{endTime}}`.

When syncing is on, adding a timeblock creates an event, editing it (including dragging or resizing it in the calendar) updates the event, and removing it, or deleting its daily note, deletes the event. Moving a timeblock to another day keeps the same event. Copying a timeblock creates a separate event, so deleting the copy leaves the original's event alone. A timeblock whose ID also appears in an older note (for example, one added by a template) is not treated as moved there; removing it deletes its event.

A daily note moved outside Obsidian (by a file manager, git or a sync client) keeps its events, as long as the moved file appears within a few seconds or, for moves made while Obsidian was closed, keeps its file name. Events are not deleted while a note's frontmatter cannot be read, for example while you are editing the YAML by hand, or while a timeblock is incomplete, such as one without a title.

Existing timeblocks are not exported when you turn syncing on; each one is synced the next time you edit it. Event descriptions contain the timeblock's description and attachments, and a link to the daily note when **Include Obsidian link** is on. The task export's event color also applies.

TaskNotes keeps the link between each timeblock and its event in plugin data, not in the daily note. If Google Calendar cannot be reached, creates, updates and deletions are retried in the background. When Obsidian starts, changes made while it was closed to timeblocks that already have events are synced. Changing **Timeblock calendar** moves existing events to the new calendar the next time each timeblock is synced. Turning syncing off leaves existing events in place.

Timeblock sync is available for Google Calendar only.
