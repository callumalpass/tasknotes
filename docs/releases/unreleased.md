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

- (#871) Fixed Bases Kanban drag-and-drop updating wrong property when grouped by custom fields
  - Fixed groupBy configuration retrieval to access `controller.query.views` internal structure
  - Added support for both Bases 1.10.0+ format (`{property: string, direction: string}`) and legacy string format
  - Fixed caching issue where null groupBy values were cached permanently, preventing retries
  - Note: GroupBy is not exposed in the Bases public API (`config.get('groupBy')` returns undefined)
  - Known limitation: When grouping by projects, Bases groups by literal wikilink strings, not resolved file paths
    - Tasks with different wikilink formats pointing to the same project file will appear in separate columns
    - Example: `[[Project]]`, `[[path/to/Project]]`, and `[[Project|Alias]]` create separate columns
    - This differs from native TaskNotes Kanban which resolves all wikilinks to absolute paths
  - Thanks to @kmaustral for reporting

## Added

- Added date navigation configuration for Bases calendar views
  - Hardcoded date option: Set a specific date (YYYY-MM-DD format) for the calendar to display on load
  - Property-based navigation: Automatically navigate to dates from filtered note properties
  - Three navigation strategies: First result, Earliest date, or Latest date
  - Supports both static views and dynamic filtered views
  - Full i18n support for all settings in French, Spanish, German, Japanese, Russian, and Chinese

