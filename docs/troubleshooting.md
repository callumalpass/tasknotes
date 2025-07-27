# Troubleshooting

This section covers common issues and their solutions when using TaskNotes.

## Common Issues

### Tasks Not Appearing in Views

**Symptoms**: Tasks you've created don't show up in TaskNotes views

**Possible Causes**:

- Task files are missing the configured task tag
- Files are in excluded folders
- Tasks don't have valid YAML frontmatter
- Cache needs refreshing

**Solutions**:

1. Check that task files include the task tag configured in settings (default: `#task`)
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

**Possible Causes**:

- Large number of tasks or external calendar events
- Multiple ICS subscriptions with frequent refresh
- Complex recurring task patterns

**Solutions**:

1. Disable unused event types in calendar view toggles
2. Increase ICS subscription refresh intervals
3. Consider disabling note indexing in Misc settings if you don't use the Notes view
4. Reduce the number of external calendar subscriptions

### Natural Language Parsing Not Working

**Symptoms**: Natural language input doesn't extract expected task properties

**Possible Causes**:

- Natural language processing is disabled
- Input format doesn't match supported patterns
- Custom status/priority words not configured

**Solutions**:

1. Enable "Natural language input" in Task Defaults settings
2. Review supported syntax in the Natural Language Processing documentation
3. Configure custom priority and status words if using non-default values
4. Try simpler input patterns to test basic functionality

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

1. Disable note indexing in Misc settings if you don't use the Notes view
2. Reduce the number of external calendar subscriptions
3. Exclude large folders from note processing
4. Consider using simpler status and priority configurations

## External Calendar Issues

### ICS Subscriptions Not Loading

**Symptoms**: External calendar events don't appear in calendar views

**Solutions**:

1. Verify ICS URL is correct and accessible
2. Check network connection and firewall settings
3. Try manual refresh of the subscription
4. Validate ICS feed using online ICS validators
5. Check error messages in subscription status

### Calendar Sync Problems

**Symptoms**: External calendar changes not reflected in TaskNotes

**Solutions**:

1. Check refresh interval settings for the subscription
2. Manually refresh the subscription
3. Verify the external calendar is actually updated at the source
4. Clear cached calendar data by removing and re-adding subscription

## Getting Help

### Diagnostic Information

When reporting issues, include:

1. TaskNotes version number
2. Obsidian version
3. Operating system
4. Specific error messages
5. Steps to reproduce the issue
6. Screenshots if relevant

### Community Support

- Check the GitHub repository for existing issues
- Search community forums for similar problems
- Review documentation for configuration guidance

### Configuration Reset

If all else fails, you can reset TaskNotes configuration:

1. Close Obsidian
2. Navigate to `.obsidian/plugins/tasknotes/`
3. Rename or delete `data.json`
4. Restart Obsidian (this will reset all settings to defaults)

!!! warning "Important"
    Resetting configuration will lose all custom settings, status configurations, and ICS subscriptions. Export or document your current settings before resetting.
