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

- ([#1858](https://github.com/callumalpass/tasknotes/issues/1858)) Included task body details in single-task HTTP API and MCP reads. Thanks to @vanillaflava for reporting and outlining the expected behavior.
- ([#1859](https://github.com/callumalpass/tasknotes/issues/1859)) Clarified the Google Calendar setup guide for OAuth testing-mode `access_denied` errors. Thanks to @PE-Boy for reporting and @tiagoarroz for the workaround.
- ([#1860](https://github.com/callumalpass/tasknotes/issues/1860)) Preserved accented characters in tags when converting checkbox tasks to TaskNotes. Thanks to @e-zz for reporting.
- ([#1869](https://github.com/callumalpass/tasknotes/issues/1869)) Preserved Calendar Month View scroll position after task updates. Thanks to @sisyowo for reporting and linking the earlier Kanban fix.
- ([#1873](https://github.com/callumalpass/tasknotes/issues/1873)) Fixed calendar resizing during pop-out and embedded view transitions so Obsidian no longer freezes while the calendar is being moved. Thanks to @misolex for reporting.
- ([#1870](https://github.com/callumalpass/tasknotes/issues/1870)) Fixed NLP file suggestions for list-type custom fields so selected wikilinks are captured as custom field values. Thanks to @Sineapple for reporting and @Xananax for the follow-up details.
- (#1888) Allowed project autosuggest required property filters to match any comma-separated value, such as `project, area`. Thanks to @BrianHicks for suggesting.
- ([#1886](https://github.com/callumalpass/tasknotes/issues/1886)) Added a command to postpone active overdue scheduled tasks to today. Thanks to @chrabia for the suggestion.
- (#1889) Fixed Kanban swimlanes for list-valued properties so tags and contexts use individual list items instead of comma-joined values. Thanks to @pkropotin for reporting.
- (#1890) Fixed scheduled-date Kanban columns dropping tasks when date-only and timed tasks on the same day are sorted by a scheduled-time formula. Thanks to @chrabia for reporting and investigating.
- (#1892) Fixed nested Markdown list indentation in the Task Edit Modal details editor. Thanks to @Glint-Eye for reporting.
- (#1891) Fixed TaskNotes modal markdown editors collapsing to one-character-wide lines when Pretty Properties is installed. Thanks to @bkennedy-improving for reporting.
- Restored padding in task modal Markdown editors.
- Made the markdown editor areas in task modals easier to click and focus.
- Strengthened local CSS linting to catch unscoped selectors, unknown CSS, and fixed-position overlays before review.
- Reduced false-positive plugin review warnings by making background auto-export and auto-archive schedulers non-overlapping and tightening type/string conversion paths.
