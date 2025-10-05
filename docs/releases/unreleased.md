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

- Added grouped rendering support for Bases integration list and kanban views
  - List view displays collapsible groups with toggle controls
  - Kanban view renders grouped columns with drag-drop support
  - Automatically detects ungrouped views and renders as flat list

## Changed

- Migrated Bases integration to use public API (Bases 1.10.0+) with graceful fallback to internal API for older versions

## Fixed

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

