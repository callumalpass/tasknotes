# TaskNotes - Unreleased

## Added

- Added a date format setting under Appearance → Display formatting. Choose ISO 8601 dates across TaskNotes while keeping the separate 12/24-hour preference. Stored dates and custom Bases formulas are unchanged. See [Appearance settings](https://tasknotes.dev/settings/appearance/). Thanks to @spozzi99 for requesting this in [#2354](https://github.com/callumalpass/tasknotes/issues/2354).

## Changed

- Rebuilt settings around Obsidian’s native navigation, search, and editable lists. Individual settings are searchable. Ordinary preferences and property triggers use inline groups, while larger editors and advanced filters retain detail pages. See [Settings](https://tasknotes.dev/settings/) for the new layout.
- TaskNotes now requires Obsidian 1.13.1 or newer.
- Task cards show dates within a week of today as relative days, such as "Due: Yesterday", "Due: 3 days ago" or "Scheduled: Monday". The full date appears on hover. Past scheduled dates no longer carry a "(past)" suffix. Choosing ISO dates keeps absolute dates.
- Task cards no longer repeat the task title as a "file name" property, and tags shown through Bases use the same tag style and identifying-tag hiding as other tags. New vaults hide the identifying tag on cards by default.
- Kanban swimlanes can be collapsed from their label. Empty swimlanes start collapsed.
- The task dialog labels its date buttons ("Due: …", "Scheduled: …") and always shows the current status and priority. While typing natural language in the create dialog, the buttons show the values that will be saved.
- In the edit dialog, fields line up in one column, Archive is a plain button, and Delete is a quieter text button.
- The task context menu keeps status, priority, dates, reminders, time tracking, edit and open at the top level. Other actions are under "More".
- Calendar year view shows the first event on each day instead of collapsing every day into "+1 more". The refresh button only appears when external calendars are connected, and the custom day-count view button has a tooltip.

## Fixed

- Fixed task dialogs falling back to plain text inputs when opened without an active note, including from release notes or in an empty vault.

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

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->
