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

- ([#1888](https://github.com/callumalpass/tasknotes/issues/1888)) Allowed project autosuggest required property filters to match any comma-separated value, such as `project, area`. Thanks to @BrianHicks for suggesting.
- ([#1889](https://github.com/callumalpass/tasknotes/issues/1889)) Fixed Kanban swimlanes for list-valued properties so tags and contexts use individual list items instead of comma-joined values. Thanks to @pkropotin for reporting.
- ([#1890](https://github.com/callumalpass/tasknotes/issues/1890)) Fixed scheduled-date Kanban columns dropping tasks when date-only and timed tasks on the same day are sorted by a scheduled-time formula. Thanks to @chrabia for reporting and investigating.
- ([#1892](https://github.com/callumalpass/tasknotes/issues/1892)) Fixed nested Markdown list indentation in the Task Edit Modal details editor. Thanks to @Glint-Eye for reporting.
- ([#1891](https://github.com/callumalpass/tasknotes/issues/1891)) Fixed TaskNotes modal markdown editors collapsing to one-character-wide lines when Pretty Properties is installed. Thanks to @bkennedy-improving for reporting.
- Made the markdown editor areas in task modals easier to click and focus.
- Strengthened local CSS linting to catch unscoped selectors, unknown CSS, and fixed-position overlays before review.
- Reduced false-positive plugin review warnings by making background auto-export and auto-archive schedulers non-overlapping and tightening type/string conversion paths.
