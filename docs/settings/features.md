# Features Settings

These settings allow you to enable, disable, and configure the various features of the plugin, such as inline tasks, natural language processing, the Pomodoro timer, and notifications.

[← Back to Settings](../settings.md)

## Inline Tasks

- **Task link overlay**: Replaces links to tasks with an interactive widget in Live Preview mode. The widget is not shown when the cursor is on the link, to allow for editing.
- **Instant task convert**: Shows a button next to list items and checkboxes to convert them to tasks.
- **Inline task convert folder**: The folder for inline task conversion. Use `{{currentNotePath}}` for a path relative to the current note.
- **Use task defaults on instant convert**: Apply default task settings when converting text to tasks instantly.

## Body Template

- **Use body template**: Use a template file for task body content.
- **Body template file**: Path to template file for task body content. Supports template variables including `{{title}}`, `{{date}}`, `{{time}}`, `{{priority}}`, `{{status}}`, `{{contexts}}`, `{{tags}}`, and `{{projects}}`.

## Natural Language Processing

- **Enable natural language task input**: Parse due dates, priorities, and contexts from natural language when creating tasks.
- **Default to scheduled**: When NLP detects a date without context, treat it as scheduled rather than due.
- **NLP language**: The language for natural language processing patterns and date parsing.
- **Status suggestion trigger**: Text to trigger status suggestions (leave empty to disable).

## Pomodoro Timer

- **Work duration**: Duration of work intervals in minutes.
- **Short break duration**: Duration of short breaks in minutes.
- **Long break duration**: Duration of long breaks in minutes.
- **Long break interval**: Number of work sessions before a long break.
- **Auto-start breaks**: Automatically start break timers after work sessions.
- **Auto-start work**: Automatically start work sessions after breaks.
- **Pomodoro notifications**: Show notifications when Pomodoro sessions end.
- **Sound enabled**: Play sound when Pomodoro sessions end.
- **Sound volume**: Volume for Pomodoro sounds (0-100).
- **Pomodoro data storage**: Where to store Pomodoro session history. Can be either "Plugin data" or "Daily notes".

## Notifications

- **Enable notifications**: Enable task reminder notifications.
- **Notification type**: Type of notifications to show. Can be either "In-app notifications" or "System notifications".

## Performance & Behavior

- **Hide completed tasks from overdue**: Exclude completed tasks from overdue task calculations.
- **Disable note indexing**: Disable automatic indexing of notes for better performance (may reduce some features).
- **Suggestion debounce**: Debounce delay for file suggestions in milliseconds (0 = disabled).

## Time Tracking

- **Auto-stop tracking on complete**: Automatically stop time tracking when a task is marked complete.
- **Time tracking stop notification**: Show notification when time tracking is automatically stopped.

## Recurring Tasks

- **Maintain due date offset in recurring tasks**: When completing recurring tasks, maintain the offset between due and scheduled dates.

## Timeblocking

- **Enable timeblocking**: Enable timeblock functionality for lightweight scheduling in daily notes.
- **Show timeblocks**: Display timeblocks from daily notes by default.

### Usage

In the calendar view, click and drag on a time slot to select a time range. A context menu will appear—select "Create timeblock" to create a timeblock (this option only appears if timeblocking is enabled in settings). Drag existing timeblocks to move them. Resize edges to adjust duration.