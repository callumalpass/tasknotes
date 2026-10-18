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

- (#2378) Fixed dragging a Kanban card to a different column and swimlane at once leaving the card, task cache, and other views showing the old swimlane value, such as the previous priority. Thanks to @iantierney for reporting this.

- (#2399, #2377) Fixed Task List views failing with "Converting circular structure to JSON" when a displayed property or formula returns links, such as `file.backlinks`. This regression was introduced in 4.13.5. Thanks to @ewightman and @Glint-Eye for reporting this.

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

## Changed

- (#2400) Removed the decorative plus icon beside "No tasks" in empty Kanban columns and swimlane cells, which looked like an add-task button. Use the column's add-task button to create tasks. Thanks to @iantierney for reporting this.

## Removed

## Fixed

- (#2397) Fixed tags and same-note heading links such as `[[#Installation]]` being rendered as task links in Reading View when the note is a task. Thanks to @hm-24 for reporting this and @enieuwy for the fix.

- (#2390) Fixed the project selection modal showing notes from excluded folders, including when project filters are configured. Thanks to @hikatamika for reporting this.

- (#2389) Added the missing public [v4-to-v5 beta upgrade guide](https://tasknotes.dev/migration-v4-to-v5/), including synced-device and metadata-recovery instructions, and corrected the HTTP API authentication documentation. Thanks to @m4to-3pe for reporting the broken link.

- (#2382) Fixed Kanban settings being ignored in existing `.base` files when nested under `options:` or `config:`, including empty-column hiding and pinned columns. Newly generated default files and exported v3 views now write settings directly on each view; existing files remain unchanged. See [Kanban View](https://tasknotes.dev/views/kanban-view/#configuration). Thanks to @techwiththiru for reporting this.
