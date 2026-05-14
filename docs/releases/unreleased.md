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

- Improved local lint checks so package and CSS issues reported by Obsidian's online review can be caught before submission.
- Cleaned up stylesheet compatibility issues reported by Obsidian's online review without changing the intended TaskNotes appearance.
- Improved spacing and alignment in task, timeblock, and webhook modals after the stylesheet cleanup.
- Reworked optional calendar and ICS refresh scheduling to avoid `setInterval` around network requests while preserving the same refresh intervals.
- Cleaned up additional source patterns reported by Obsidian's online review, including unsafe default object stringification and redundant external type unions.
- Prevented a console error when plugin listeners are cleaned up after reloads.
- Added a local lint check to prevent `setInterval` from being reintroduced in plugin source.
