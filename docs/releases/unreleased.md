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

## Fixed

- (#1472) Fixed task dependencies not being stored as wikilinks in frontmatter
  - `serializeDependencies()` now wraps UIDs in `[[...]]` brackets before writing to YAML
  - Previously, normalization stripped wikilink brackets but serialization never re-added them, causing dependencies to break on file rename
  - Thanks to @renekalff for reporting

- (#1443) Fixed default status/priority not updating when the referenced custom value is deleted
  - Deleting a custom status or priority that was set as the default now resets the default to the first available value
  - Added validation on settings render to catch stale defaults that reference non-existent values
  - Thanks to @l-mb for the contribution
