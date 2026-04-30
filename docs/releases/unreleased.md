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

- (#1834, #1847) Fixed empty Bases formula and custom properties showing `null` or `undefined` on TaskNotes task cards.
  - A big thanks to @Glint-Eye and @3zra47 for reporting.
- (#1836) Fixed TaskNotes Bases views not refreshing task cards after status, archive, and auto-archive updates.
  - A big thanks to @kmaustral for reporting.
