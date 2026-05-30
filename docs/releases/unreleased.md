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

- (#1972) Fixed ICS calendar event related notes so standalone events with similar numeric IDs no longer show unrelated notes or tasks on every event. Thanks to @ks-studio-net for reporting this.
- (#1970) Fixed TaskNotes Bases views still rendering task files from excluded folders. Thanks to @henrim01 for reporting that this still affected 4.9.2.
- (#1968) Fixed inline task link overlays collapsing on Obsidian mobile, which could hide the task title and leave a tall empty gap after the widget. Thanks to @renatomen for reporting and diagnosing the containment issue.
