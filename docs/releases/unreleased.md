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
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

-->

## Changed

- Reorganized settings panel for improved discoverability
  - Removed "Defaults" tab - default values are now configured alongside each property in the Task Properties tab
  - Moved task filename format settings to the Title property section
  - Moved project autosuggest settings to the Projects property section
  - Body template setting moved to the Features tab
  - Added descriptions to each property explaining its purpose

