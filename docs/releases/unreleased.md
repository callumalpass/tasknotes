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

## Fixed

- (#816) Fixed template variables not processing in ICS subscription note folder paths
  - Template variables like `{{year}}`, `{{month}}`, `{{date}}` now work in ICS note folder settings
  - Extracted folder template processing into shared utility for consistency
  - Added support for ICS-specific variables: `{{icsEventTitle}}`, `{{icsEventLocation}}`, `{{icsEventDescription}}`
  - Users can now organize ICS notes in date-based hierarchies (e.g., `Daily/{{year}}/{{month}}/`)
  - Thanks to @j-peeters for reporting

- (#829) Fixed time estimates and recurrence patterns being lost during instant task conversion
  - Added `timeEstimate` field to `ParsedTaskData` interface
  - Time estimates from natural language parsing now properly transferred to task frontmatter
  - Parsed values now take priority over default settings
  - RRule strings passed directly without conversion (preferred format)

