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

- (#1437) Unified template variable syntax and available variables across filename and body templates
  - Both systems now use double-brace `{{variable}}` syntax consistently
  - Single-brace `{variable}` syntax remains supported for backwards compatibility but is deprecated
  - Settings UI shows a warning when deprecated single-brace syntax is detected
  - Filename templates gain body template variables: `{{contexts}}`, `{{tags}}`, `{{hashtags}}`, `{{timeEstimate}}`, `{{details}}`, `{{parentNote}}`
  - Body templates gain filename template variables: `{{zettel}}`, `{{nano}}`, and all extended date/time variables

## Added

- (#1361) Option to disable inline task overlay for aliased wikilinks
  - New setting in Features → Inline Tasks: "Disable overlay for aliased links"
  - When enabled, links with aliases like `[[Task|Check Status]]` render as plain links
  - Links without aliases continue to show the interactive task widget
  - Useful when embedding tasks in prose where the widget would be disruptive
  - Thanks to @diegomarzaa for the contribution and @jldiaz for proposing this feature in #1117

- (#1205) Google Calendar export for tasks
  - Sync tasks to Google Calendar based on scheduled or due dates
  - Automatic sync on task create, update, complete, and delete
  - Configurable event title templates with placeholders (`{{title}}`, `{{status}}`, `{{priority}}`, etc.)
  - Event descriptions include task metadata and optional Obsidian deep link
  - Support for all-day or timed events with customizable duration
  - Event color customization using Google Calendar's color palette
  - Default reminder setting for popup notifications
  - Bulk sync and unlink actions in settings
  - Task-event linking stored in frontmatter (`googleCalendarEventId`)

## Fixed

- (#1413) Fixed angle-bracket links and project title display
  - Angle-bracket links like `[Spec](<Projects/Client X/Spec.md>)` now resolve correctly
  - Project links display frontmatter `title` instead of raw filename/path when available
  - Dependency values normalize consistently across wikilinks, markdown links, and angle-bracket variants
  - Many thanks to @normenmueller for the contribution

- (#1414) Kanban column headers now display configured priority labels instead of raw values
  - Many thanks to @normenmueller for the contribution

- (#1416) Fixed property-based task identification mutating tags unexpectedly
  - Tags are only written when explicitly changed by the user
  - Task tag is only added in tag-based identification mode
  - Fixes #1391
  - Many thanks to @normenmueller for the contribution

- (#1187) Fixed "Unknown view types" error when opening Bases views after upgrading from pre-V4
  - Users who had disabled Bases support in earlier versions could not open Bases views after upgrading
  - Settings migration now automatically re-enables Bases support since the toggle was removed in V4
  - Thanks to @MiracleXYZ for reporting
