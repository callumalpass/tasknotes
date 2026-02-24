# Troubleshooting

Common issues and solutions for TaskNotes.

When debugging, start with the smallest reproducible scenario: one affected task, one affected view, and current settings. Most issues fall into one of three categories: task identification mismatch, malformed frontmatter, or view/cache state.

## Bases and Views (v4)

### Views Not Loading

**Symptoms**: TaskNotes views show errors or don't display tasks

First confirm Bases is enabled (`Settings -> Core Plugins -> Bases`), then restart Obsidian once. If views are still missing, verify `.base` files exist in `TaskNotes/Views/`. If needed, regenerate defaults from `Settings -> TaskNotes -> Integrations` (`Create default files`).

### Commands Open Wrong Files

**Symptoms**: Ribbon icons or commands open unexpected files

Check command mappings in `Settings -> TaskNotes -> General` (`View Commands`). Reset mappings that were changed unintentionally, then verify each referenced `.base` file exists at the configured path.

## Common Issues

### Tasks Not Appearing in Views

**Symptoms**: Tasks you've created don't show up in TaskNotes views

Common causes are task-identification mismatch, excluded folders, invalid frontmatter, or stale view state. Verify the configured task identifier is present, ensure files are not excluded, and confirm YAML frontmatter is valid and wrapped with `---` delimiters. If all data looks correct, reopen the affected view and then restart Obsidian to refresh cache state.

### Task Link Widgets Not Working

**Symptoms**: Links to task files appear as normal wikilinks instead of interactive widgets

Check that **Task link overlay** is enabled, then verify linked files are actually recognized as tasks (matching tag/property configuration). Links to normal notes will render as normal links by design.

### Instant Conversion Buttons Missing

**Symptoms**: Convert buttons don't appear next to checkbox tasks

Instant convert buttons only appear when the feature is enabled, in edit mode, and with cursor proximity to list items. Enable the feature, switch from reading mode to edit mode, and place the cursor near the target checkbox.

### Calendar View Performance Issues

**Symptoms**: Calendar views are slow or unresponsive

Reduce visible event layers first (scheduled/due/recurring/time entries), then increase ICS refresh intervals and shorten displayed date ranges. If slowness persists, apply the general performance guidance below.

### Natural Language Parsing Not Working

**Symptoms**: Natural language input doesn't extract expected task properties

Enable NLP in `Settings -> TaskNotes -> Features`, then verify your trigger characters (`@`, `#`, `!` by default) and any custom status/priority mappings. If parsing still seems inconsistent, compare input against the syntax in [NLP API](nlp-api.md).

### Time Tracking Issues

**Symptoms**: Time tracking doesn't start/stop properly or data is lost

Most tracking issues come from overlapping sessions, interrupted shutdowns, or save failures. Stop active sessions before starting new ones, confirm files are writable, and restart interrupted sessions. If needed, repair malformed time entries directly in frontmatter.

## Data Issues

### Corrupted Task Files

**Symptoms**: Tasks appear broken or cause errors in views

Open the task file directly and validate frontmatter syntax. Quote values that include special characters, validate YAML if necessary, and restore from backup for severe corruption.

### Missing Task Properties

**Symptoms**: Tasks missing expected properties or using default values unexpectedly

Check field mappings first, then confirm Task Defaults. If properties are absent on older notes, add them manually or re-save through TaskNotes so current mapping rules are applied.

### Date Format Issues

**Symptoms**: Dates not displaying correctly or causing parse errors

Use supported formats (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`), quote where needed, and re-enter problematic dates via TaskNotes date pickers to normalize formatting and timezone handling.

## Notifications

### "Monitoring 0 bases"

**Symptoms**: The notification system reports "monitoring 0 bases" even though you have `.base` files with `notify: true`

This is a known issue with `BasesQueryWatcher` not detecting bases on startup in some configurations. As a workaround, open the `.base` file directly — once Obsidian renders the view, the watcher picks it up. Restarting Obsidian may also help. A permanent fix is on the roadmap.

### Not Receiving Notifications for Assigned Tasks

**Symptoms**: You have "Only notify for my tasks" enabled but notifications are not showing

Verify your device is registered to a person note in Settings > Team & Attribution. Check that the task's `assignee` field contains your person note (or a group you belong to) as a wikilink. If using groups, confirm the group note has your person note in its `members` array.

## Bulk Tasking

### Duplicate Tasks After Bulk Generate

**Symptoms**: Running bulk generate twice on the same view creates duplicate task files

Enable the **Skip existing** toggle in the Generate tab (on by default). If duplicates were already created, they can be identified by having identical `projects` links pointing to the same source note. A future update will add cross-mode warnings when both Generate and Convert are used on the same items.

### Large Views Slow to Open Bulk Modal

**Symptoms**: Opening the bulk tasking modal on a view with 40+ items takes several seconds before anything appears

TaskNotes currently processes all items before rendering the modal. This is a known performance limitation. As a workaround, apply filters to reduce the view scope before opening the bulk modal. Chunked/streaming rendering is planned.

## Device Identity

### Lost Device Identity After Reinstall

**Symptoms**: After reinstalling Obsidian, your device is no longer mapped to your person note

The device UUID is stored in Obsidian's `localStorage`, which is wiped on reinstall. Go to Settings > Team & Attribution and re-register your device to your person note. Existing tasks are unaffected — they reference your person note by name, not by device ID. See [Team & Attribution — Device Identity](features/shared-vault.md#device-identity) for details.

## Performance Troubleshooting

### Slow View Loading

To improve loading times, reduce external calendar subscriptions, increase ICS refresh intervals, exclude large folders, and disable event types you do not use.

## External Calendar Issues

### OAuth Calendar Not Connecting

**Symptoms**: Google Calendar or Microsoft Outlook won't connect

Verify credentials and loopback redirect configuration (`127.0.0.1` with dynamic local port), ensure app publication/test-user access is correct, and retry after disconnecting. Also check popup blockers. For provider-specific setup details, use [Calendar Setup](calendar-setup.md).

### OAuth Calendar Not Syncing

**Symptoms**: Connected calendar shows old events or doesn't update

Run manual refresh, check last-sync timestamps, reconnect if needed, and verify events exist in the source provider before debugging TaskNotes behavior.

### ICS Subscriptions Not Loading

**Symptoms**: ICS calendar events don't appear in calendar views

Confirm the ICS URL/file is reachable, run manual refresh, validate the feed format, and inspect subscription status errors for provider-side failures.

### Calendar Sync Problems

**Symptoms**: External calendar changes not reflected in TaskNotes

Check refresh intervals and force a manual refresh first. If source data is current but TaskNotes remains stale, remove and re-add the subscription to clear cached state.

## Getting Help

### Collecting Debug Logs

TaskNotes has built-in debug logging that captures detailed information about plugin operations. Enable it before reproducing an issue to get logs you can include in bug reports.

1. Go to **Settings > TaskNotes > Developer Options** (bottom of settings)
2. Turn on **Enable debug logging**
3. Choose output destinations:
   - **File (`debug.log`)** — creates a `debug.log` file in your vault root. Easy to copy-paste into a bug report.
   - **Console (`Ctrl+Shift+I`)** — logs to the browser developer console. Useful for real-time debugging.
4. Optionally filter by category (e.g., only notifications, only bulk operations) to reduce noise
5. Reproduce the issue
6. Copy the relevant log entries

> [!tip] Include logs in bug reports
> When filing an issue, paste the relevant portion of `debug.log` or console output. Logs include timestamps, component tags, and data payloads that help pinpoint the problem. Remember to remove any sensitive information (file paths, person names) before sharing.

To clear logs, click **Clear debug log** in the Developer Options section. To disable logging, toggle the master switch off — both file and console output stop immediately.

### Reporting Issues

Report bugs or feature requests on [GitHub Issues](https://github.com/cybersader/tasknotes/issues). For contributing code or documentation, see [Contributing](contributing.md). Include:

- TaskNotes and Obsidian versions
- Operating system
- Steps to reproduce
- Error messages (open console with `Ctrl/Cmd + Shift + I`)
- Debug log output (see [Collecting Debug Logs](#collecting-debug-logs) above)
- Screenshots if relevant

### Configuration Reset

If all else fails, reset TaskNotes configuration:

1. Close Obsidian
2. Navigate to `.obsidian/plugins/tasknotes/`
3. Rename or delete `data.json`
4. Restart Obsidian

> [!warning]
> This resets all settings, status configurations, and calendar subscriptions. Document your settings before resetting.
