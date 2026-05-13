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

- Enabled lint checks that mirror Obsidian community plugin review findings, including dynamic code execution, Promise handling, deprecated APIs, unsafe stringification, directive comments, Node built-in imports, and explicit `any` usage.
- Clarified privacy documentation for optional integrations that make periodic background network refreshes.
- Cleaned up internal Obsidian and Bases compatibility adapters used by search and grouped views.

## Fixed

- Fixed project autocomplete searches so non-empty `+` queries only return files matching the query in the basename, title, aliases, or explicitly searchable metadata rows.

## Removed

- Removed JavaScript webhook transform support and examples. JSON webhook transform templates remain supported.
