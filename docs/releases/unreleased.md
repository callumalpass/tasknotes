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

- (#601) Fixed Unicode characters not displaying in tags and contexts
  - Unicode characters (Š, Ė, Ž, Ą, etc.) are now properly preserved in tags and contexts
  - Affects Agenda View, Task List View, and all other views displaying tags
  - Thanks to @Kapinekas for reporting
- (#778) Fixed cursor artifacts in CodeMirror widgets
  - Thanks to @jhedlund for the fix

## Changed

- Refactored widget cursor styles into reusable utility class
  - Consolidated shared CSS into .cm-widget-cursor-fix utility
  - Improved maintainability across widget components

