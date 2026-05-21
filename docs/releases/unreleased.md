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

- (#1922) Restored the native color picker alongside manual color text entry in Create/Edit Timeblock fields.
  - Thanks to @AndreMonthy for reporting.
- (#1921) Fixed direct frontmatter edits to lifecycle-relevant task fields not triggering Google Calendar sync or auto-archive side effects.
  - Thanks to @martin-forge for reporting and verifying the direct-edit reproduction.
- (#1919) Fixed the Pomodoro view rapidly resizing at certain sidebar sizes.
  - Thanks to @RumiaKitinari for reporting.
- (#1898) Fixed Calendar Day view time labels shifting into the middle of the grid after switching views.
  - Thanks to @ddevaal for reporting and confirming the regression.
- (#1916) Fixed Markdown task links using Obsidian's generated filename label instead of the TaskNote title in the task link overlay.
  - Thanks to @minchinweb for reporting.
- (#1911) Fixed recurrence choices starting from today instead of the selected calendar date when creating a task from Calendar view.
  - Thanks to @mikhailmarka for reporting.
- (#1912) Fixed "Create subtask" pre-filling the parent task's full folder path in the Projects field instead of using the normal Obsidian link text.
  - Thanks to @pkuehne for reporting.
