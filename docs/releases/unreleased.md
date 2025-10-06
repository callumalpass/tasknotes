# TaskNotes - Unreleased

<!--

**Added** for new features.
**Changed** for changes in existing functionality.
**Deprecated** for soon-to-be removed features.
**Removed** for now removed features.
**Fixed** for any bug fixes.
**Security** in case of vulnerabilities.

Always acknowledge contributors and those who report issues.

Example:

```
## Fixed

- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

-->

## Added

- Added Calendar view for Bases plugin integration (requires Bases 1.10.0+)
  - Supports month, week, day, year, and list views
  - Property-based events from note date properties (configurable start date, end date, and title properties)
  - Custom card rendering in list view for tasks, timeblocks, ICS events, and property-based events
  - Layout options: time format, weekend visibility, all-day slot, today highlight, scroll time, event height
  - Visibility toggles for event types (scheduled, due, recurring, time entries, timeblocks, property-based)
  - Date validation to handle invalid property values
  - Drag-and-drop to update property-based event dates in frontmatter
  - Full internationalization support for calendar features in 7 languages (English, French, Spanish, German, Japanese, Russian, Chinese)

- Added grouped rendering support for Bases integration list and kanban views
  - List view displays collapsible groups with toggle controls
  - Kanban view renders grouped columns with drag-drop support
  - Automatically detects ungrouped views and renders as flat list

- (#842) Added keyboard navigation support for task forms
  - Action bar icons now focusable with proper tab order and ARIA attributes
  - Enter and Space keys trigger actions on focused elements
  - Added submenu support for reminders button for better keyboard accessibility
  - Improved focus indicators for better visual feedback
  - Thanks to @maybetm for this excellent contribution!

## Changed

- Migrated Bases integration to use public API (Bases 1.10.0+) with graceful fallback to internal API for older versions

## Fixed

- (#825) Fixed single/double click settings not applying to calendar views
  - Shared click handling now works consistently across Advanced Calendar and Bases Calendar
  - Ctrl/Cmd+click opens tasks in new tab as expected
  - Single and double-click actions respect user settings

- (#699) Fixed Obsidian freezing when moving calendar tab to new window
  - Skip calendar resize during window transfer to prevent freeze
  - Calendar may display incorrectly after move but can be fixed by switching views
  - Prevents complete UI lockup during tab transfer

- (#816) Fixed template variables not processing in ICS subscription note folder paths
  - Template variables like `{{year}}`, `{{month}}`, `{{date}}` now work in ICS note folder settings
  - Extracted folder template processing into shared utility for consistency
  - Added support for ICS-specific variables: `{{icsEventTitle}}`, `{{icsEventLocation}}`, `{{icsEventDescription}}`
  - Users can now organize ICS notes in date-based hierarchies (e.g., `Daily/{{year}}/{{month}}/`)
  - Thanks to @j-peeters for reporting

- (#813) Fixed subscribed ICS calendars irregularly disappearing from calendar views
  - Added 5-minute grace period after cache expiration to keep events visible during refresh
  - Trigger automatic background refresh when cache is stale or missing
  - Initialize ICS service instances early so views can register event listeners before data loads
  - Prevents disappearance during network errors or when calendar opens at Obsidian startup
  - Thanks to @j-peeters for reporting

- (#829) Fixed time estimates and recurrence patterns being lost during instant task conversion
  - Added `timeEstimate` field to `ParsedTaskData` interface
  - Time estimates from natural language parsing now properly transferred to task frontmatter
  - Parsed values now take priority over default settings
  - RRule strings passed directly without conversion (preferred format)
  - Thanks to @Justin-Burg for reporting

- (#810) Fixed recurring tasks with overdue due dates disappearing from agenda view
  - Recurring tasks now check both `due` and `scheduled` dates for overdue status
  - Previously only `scheduled` was checked for recurring tasks, causing tasks with overdue `due` dates to be hidden
  - Ensures consistent overdue detection logic between recurring and non-recurring tasks
  - Thanks to @skyrunner15 for reporting

