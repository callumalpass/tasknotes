# Troubleshooting

Common issues and solutions for TaskNotes.

## Bases and Views (v4)

### Views Not Loading

**Symptoms**: TaskNotes views show errors or don't display tasks

**Solutions**:

1. Enable the Bases core plugin: Settings → Core Plugins → Bases
2. Restart Obsidian after enabling Bases
3. Check that `.base` files exist in `TaskNotes/Views/`
4. Use Settings → TaskNotes → Integrations → "Create default files" to regenerate view files

### Commands Open Wrong Files

**Symptoms**: Ribbon icons or commands open unexpected files

**Solutions**:

1. Check view file paths in Settings → TaskNotes → Integrations → View Commands
2. Click "Reset" next to each command to restore default paths
3. Verify the `.base` files exist at the configured paths

## Common Issues

### Tasks Not Appearing in Views

**Symptoms**: Tasks you've created don't show up in TaskNotes views

**Possible Causes**:

- Task files are missing the configured task tag
- Files are in excluded folders
- Tasks don't have valid YAML frontmatter
- Cache needs refreshing

**Solutions**:

1. Check that task files include the task tag configured in settings (default: `task`)
2. Verify task files are not in folders listed in "Excluded folders" setting
3. Ensure YAML frontmatter is properly formatted with opening and closing `---` lines
4. Try closing and reopening TaskNotes views to refresh the cache
5. Restart Obsidian if cache issues persist

### Task Link Widgets Not Working

**Symptoms**: Links to task files appear as normal wikilinks instead of interactive widgets

**Possible Causes**:

- Task link overlay is disabled in settings
- Task files don't have the required task tag
- Links are to non-task files

**Solutions**:

1. Enable "Task link overlay" in Inline Task Settings
2. Ensure linked files have the configured task tag in their frontmatter
3. Verify you're linking to actual task files created by TaskNotes

### Instant Conversion Buttons Missing

**Symptoms**: Convert buttons don't appear next to checkbox tasks

**Possible Causes**:

- Instant task convert is disabled
- Not in edit mode
- Cursor not near checkbox tasks

**Solutions**:

1. Enable "Instant task convert" in Inline Task Settings
2. Switch to edit mode (not reading mode)
3. Position cursor near checkbox tasks to make buttons visible

### Calendar View Performance Issues

**Symptoms**: Calendar views are slow or unresponsive

**Solutions**:

1. Disable unused event types (scheduled, due, recurring, time entries) in view settings
2. Increase ICS subscription refresh intervals
3. Reduce the date range displayed
4. See [Performance Troubleshooting](#performance-troubleshooting) for general tips

### Natural Language Parsing Not Working

**Symptoms**: Natural language input doesn't extract expected task properties

**Solutions**:

1. Enable "Natural language input" in Settings → TaskNotes → Features
2. Check trigger characters match your input (default: `@` for contexts, `#` for tags, `!` for priority)
3. Configure custom status/priority words in Settings → TaskNotes → Task Properties
4. See [NLP API](nlp-api.md) for supported syntax

### Time Tracking Issues

**Symptoms**: Time tracking doesn't start/stop properly or data is lost

**Possible Causes**:

- Multiple time tracking sessions active
- Browser/Obsidian closed during active session
- Task file permissions or save issues

**Solutions**:

1. Stop any active time tracking before starting new sessions
2. Manually edit task frontmatter to fix corrupted time entries
3. Check that task files can be saved (not read-only)
4. Restart active time tracking sessions after unexpected shutdowns

## Data Issues

### Corrupted Task Files

**Symptoms**: Tasks appear broken or cause errors in views

**Solutions**:

1. Open the task file directly and check YAML frontmatter syntax
2. Ensure YAML values are properly quoted when containing special characters
3. Validate YAML syntax using an online YAML validator
4. Restore from backup if file corruption is severe

### Missing Task Properties

**Symptoms**: Tasks missing expected properties or using default values unexpectedly

**Solutions**:

1. Check field mapping settings to ensure property names match your expectations
2. Verify default values in Task Defaults settings
3. Manually add missing properties to task frontmatter
4. Re-save tasks through TaskNotes to apply current field mapping

### Date Format Issues

**Symptoms**: Dates not displaying correctly or causing parse errors

**Solutions**:

1. Use supported date formats: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
2. Check that dates are quoted in YAML frontmatter when necessary
3. Verify time zone handling for dates with time components
4. Re-enter dates through TaskNotes date pickers to ensure correct format

## Performance Troubleshooting

### Slow View Loading

**Solutions**:

1. Reduce the number of external calendar subscriptions
2. Increase ICS refresh intervals (Settings → Integrations → Calendar subscriptions)
3. Exclude large folders (Settings → General → Excluded folders)
4. Disable unused calendar event types in view settings

## External Calendar Issues

### OAuth Calendar Not Connecting

**Symptoms**: Google Calendar or Microsoft Outlook won't connect

**Solutions**:

1. Verify Client ID and Client Secret are correct (no extra spaces)
2. Check redirect URI matches exactly: `http://localhost:42813/callback`
3. Ensure the OAuth app is published or you're listed as a test user
4. Try disconnecting and reconnecting
5. Check browser popup blockers aren't blocking the auth window
6. See [Calendar Setup](calendar-setup.md) for detailed OAuth configuration

### OAuth Calendar Not Syncing

**Symptoms**: Connected calendar shows old events or doesn't update

**Solutions**:

1. Click the manual refresh button in Settings → Integrations
2. Check "Last sync time" to see when data was last fetched
3. Disconnect and reconnect the calendar
4. Verify events exist in the source calendar

### ICS Subscriptions Not Loading

**Symptoms**: ICS calendar events don't appear in calendar views

**Solutions**:

1. Verify ICS URL is correct and accessible
2. Check network connection and firewall settings
3. Try manual refresh of the subscription
4. Validate ICS feed using an online ICS validator
5. Check error messages in subscription status

### Calendar Sync Problems

**Symptoms**: External calendar changes not reflected in TaskNotes

**Solutions**:

1. Check refresh interval settings for the subscription
2. Manually refresh the subscription
3. Verify the external calendar is actually updated at the source
4. Remove and re-add the subscription to clear cached data

## Getting Help

### Reporting Issues

Report bugs on [GitHub Issues](https://github.com/callumalpass/tasknotes/issues). Include:

- TaskNotes and Obsidian versions
- Operating system
- Steps to reproduce
- Error messages (open console with `Ctrl/Cmd + Shift + I`)
- Screenshots if relevant

### Configuration Reset

If all else fails, reset TaskNotes configuration:

1. Close Obsidian
2. Navigate to `.obsidian/plugins/tasknotes/`
3. Rename or delete `data.json`
4. Restart Obsidian

!!! warning
    This resets all settings, status configurations, and calendar subscriptions. Document your settings before resetting.
