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

- Added date navigation configuration for Bases calendar views
  - Hardcoded date option: Set a specific date (YYYY-MM-DD format) for the calendar to display on load
  - Property-based navigation: Automatically navigate to dates from filtered note properties
  - Three navigation strategies: First result, Earliest date, or Latest date
  - Supports both static views and dynamic filtered views
  - Full i18n support for all settings in French, Spanish, German, Japanese, Russian, and Chinese

## Changed

- Release notes now bundle all versions from current and previous minor series with collapsible sections
  - Includes release dates extracted from git tags
  - Current version expanded by default with visual badge
  - Previous versions collapsed for easier navigation
  - Added setting to disable automatic release notes display after updates

