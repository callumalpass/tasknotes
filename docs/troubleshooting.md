# Troubleshooting

Common issues and solutions for TaskNotes.

When debugging, start with one affected task and one affected view. Record the TaskNotes version from the plugin list, the Obsidian version from **About**, the operating system, and whether the problem also occurs in a fresh default Base.

## First checks

1. Confirm Obsidian meets the current [version requirement](reference/compatibility.md) and **Bases** is enabled.
2. Open the affected task as Markdown and validate the `---` frontmatter delimiters and indentation.
3. Confirm the task matches **Settings → TaskNotes → General → Task identification** and is not in an excluded folder.
4. Run **TaskNotes: Refresh cache** from the command palette.
5. Close and reopen the affected `.base` file.
6. Restart Obsidian only after the targeted checks above.

If the issue remains, enable **Settings → TaskNotes → Features → Debug logging**, reproduce it once, and inspect the developer console with `Ctrl/Cmd + Shift + I`. Disable debug logging after collecting the relevant entries.

## Bases and Views (v4)

### Views Not Loading

**Symptoms**: TaskNotes views show errors or don't display tasks

First confirm Bases is enabled (`Settings -> Core Plugins -> Bases`), then restart Obsidian once. If views are still missing, verify `.base` files exist in `TaskNotes/Views/`. If needed, regenerate defaults from `Settings -> TaskNotes -> General -> Views & base files` (`Create files`).

### Commands Open Wrong Files

**Symptoms**: Ribbon icons or commands open unexpected files

Check command mappings in `Settings -> TaskNotes -> General` (`View Commands`). Reset mappings that were changed unintentionally, then verify each referenced `.base` file exists at the configured path.

## Common Issues

### Tasks Not Appearing in Views

**Symptoms**: Tasks you've created don't show up in TaskNotes views

Follow this decision tree:

1. **Does Quick actions for current task work on the note?**
   - **No:** compare its tag or identification property with **General → Task identification**.
   - **Yes:** task recognition works; continue to the Base filter.
2. **Is the note inside an excluded folder?**
   - **Yes:** move it or update **Excluded folders**.
   - **No:** continue.
3. **Does a newly generated default task Base show it?**
   - **Yes:** the custom Base has a stale property name or filter.
   - **No:** run **TaskNotes: Refresh cache** and validate the frontmatter.
4. **Did identification or field mapping change recently?**
   - **Yes:** update the default Base files or edit their filters and columns. Generated files do not update automatically when settings change.

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

### Reporting Issues

Report bugs on [GitHub Issues](https://github.com/callumalpass/tasknotes/issues). Include:

- Exact TaskNotes and Obsidian versions
- Operating system
- The smallest affected task frontmatter with private values removed
- The `.base` path and whether a regenerated default has the same problem
- Steps to reproduce from a fresh Obsidian start
- Relevant console errors and TaskNotes debug entries
- Screenshots if relevant

### Configuration Reset

Use a reversible reset only after the checks above:

1. Close Obsidian
2. Navigate to `.obsidian/plugins/tasknotes/`
3. Copy `data.json` to a backup outside the plugin directory
4. Rename the original to `data.json.backup-YYYY-MM-DD`
5. Restart Obsidian

!!! warning
    A reset affects settings, status and priority configurations, integration state, saved views, and plugin-stored Pomodoro history. Keep the backup until the problem is resolved. Restore it only while Obsidian is closed.

For full restore and uninstall guidance, see [Backup, restore, and removal](guides/backup-recovery.md).
