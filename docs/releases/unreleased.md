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

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->

## Added

- (#2001) Added separate templates for materialized occurrence notes, including parent-level `occurrence_template` support and a global fallback setting. Thanks to @BrucePlumb for suggesting a separate occurrence-note template and @ak-42 for the related per-recurrence template request.

## Changed

- (#2005) Excluded archived task notes and archived project-note references from Task & Project Statistics. Thanks to @Xiarno for suggesting this.

## Fixed

- (#2004) Fixed the Pomodoro start command forgetting the selected task after it was completed, so reopening the task lets it be picked up again. Thanks to @MPourjam for reporting this.
- (#1996) Made Kanban card drag-and-drop show a clear drop slot marker while cards are being repositioned, so the landing position remains visible during sorting. Thanks to @phillipadsmith for reporting this.
