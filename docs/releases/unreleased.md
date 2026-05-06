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

## Added

- Added configurable title-derived TaskNote filename styles, including lowercase `snake_case` slugs and Title Case TaskForge source folders for canonical TaskNotes paths.

## Fixed

- Fixed inline task conversion so existing `[[...|note]]` canonical note links are used as the created TaskNote path and title.
- Fixed inline task conversion so natural language parsing can enrich metadata without renaming the existing task title.
- Added a setting for existing canonical TaskNotes during inline conversion, including an ask-with-diff flow to choose which metadata and body content to keep.
