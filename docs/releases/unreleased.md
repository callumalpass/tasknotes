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

- Restored quiet, live status-colour tints in flat and swimlane Kanban columns, including theme changes and neutral fallback for invalid colours.
  - Thanks to @nesyeklaf for contributing status-coloured columns in #2260.
- Kept due and scheduled dates visible in compact phone-width task rows, prioritizing due dates if space runs out.
- Rendered native Bases dates as read-only labels in property-event cards rather than disabled date inputs.
- Preserved task-specific next-occurrence feedback when dropping a single recurring task on a completed Kanban column.
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

## Changed

- Mobile task lists, agendas and inline references give task titles a full line, with dates underneath and grouped touch controls. Scheduled agenda entries no longer repeat the schedule beside the time column.
- Narrow calendars keep navigation and view selection together, with secondary actions in an overflow picker and a visible boundary and chevron on the compact view selector.
- Calendar event titles use height-aware line limits and a separate time line; week-view deadlines have more room. Mobile boards retain a visible horizontal scroll track and neighbouring column space.
- Hidden task metadata opens in a small read-only disclosure instead of the full editor; dates continue to take precedence over tags when space is tight.

- Task creation shows one title editor at a time: expand **More fields** to edit the parsed title, or collapse it to return to natural language input. Date pickers put precise date and time entry first and group weekday shortcuts. Unconfigured property values show one warning, and project chips use a quiet border.
- Statistics use compact metric groups, settings distinguish sections and values more clearly, and inline task references and Pomodoro task selection use shared controls. Mini-calendar item pickers show the selected date, calendar resize feedback includes the resulting duration with Undo, and release notes put changes before announcements and notices.

- Reworked the task create and edit modals. Status, priority, dates, recurrence and reminders are now labelled chips that show their current value, replacing the icons with a dot. The edit modal starts with the title, **Task information** is collapsed, and **Archive** and **Delete** moved into a **More actions** (⋯) menu beside **Open note**. Empty field rows are more compact.
- Natural language input now updates the form as you type, so the **Fill form** button and the preview under the input were removed. Removing text from the input undoes what it set, and a field you changed by hand is no longer overwritten. See [Task Management](https://tasknotes.dev/features/task-management/).
- Closing the create modal with an unsaved draft now asks whether to save or discard it, as the edit modal does. **Open note** and **Archive** in the edit modal now ask before leaving unsaved changes, rather than afterwards.
- A missing title or invalid time estimate is now shown on the field itself instead of in a notice.
- (#2492) Clicking a recurring task's status indicator now follows the status cycle, as it does for other tasks, once the first completed status has a **Next status**. It moves the series through its open statuses, and reaching a completed status completes the occurrence shown on the card. Setups without that Next status keep completing the occurrence in one click, and dropping a recurring task on Done still completes it directly. In new setups, the built-in Done status now moves on to Open, so recurring tasks get this cycle, a finished series starts its next occurrence at Open, and clicking an ordinary task at Done moves it to Open instead of None. Saved statuses are not changed, but if your first completed status already has a Next status, recurring cards now take more than one click to complete. The task context menu still completes an occurrence directly. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#completion-tracking).
  - Thanks to @Jomo94 for requesting this in #1370 and @martin-forge for the implementation
- Shortened the v5 and app announcement above the release notes, removed Android tester sign-up instructions, and refreshed the plugin beta link.
- (#2486) Collapsed Kanban columns now show the column's icon and title in the collapsed strip, with the title written vertically from top to bottom and long titles cut off. Previously the title was hidden, so collapsed columns could only be told apart by their colour. See [Collapsing Columns](https://tasknotes.dev/views/kanban-view/#collapsing-columns)
  - Thanks to @UniCode9696 for the suggestion

## Fixed

- Task keyboard actions now follow the card containing keyboard focus, including after closing a property picker and tabbing to another task.
- Busy calendar days use expandable collision stacks instead of widening every day in the week. Today reveals its day, and narrow weeks offer persistent day navigation. Calendar overflow stays inside the visible pane when resized, with reachable Close controls, touch-sized rows and readable all-day titles.
- Editing a moved or resized timeblock now reads its current daily-note values, so saving its title does not restore old times.
- Inline task status changes now support Undo, including reverse cycling with Shift-click. Current-task status and priority commands, legacy status toggles, and fallback priority and date edits also use the shared Undo path.
- Selecting an adjacent-month day in the mini calendar now updates its displayed month and day grid together.
- Today and overdue date labels now use higher-contrast, theme-aware text colors in light and dark themes.
- Preserved the translated action label on Kanban column collapse buttons when showing their tooltips.
  - Thanks to @nesyeklaf for the collapsible-column contribution.
- Prevented delayed title focus from stealing typing after another task-modal field is focused.
  - Thanks to @3zra47 for reporting tag-edit persistence problems.
- Fixed pressing the save shortcut twice in quick succession creating the task twice.
- Fixed a failed follow-up step, such as updating a dependency, leaving the create modal open so that saving again created a second task. The modal now closes and a notice explains what failed.
- Fixed text in the natural language input being dropped when the task also had a prefilled title.
- Fixed edits made after using **Fill form** being overwritten by the natural language text when saving.
- Fixed Escape doing nothing in the task modals after focus had left a markdown editor.
- Fixed "1h" in the time estimate field being saved as 1 minute. The field now accepts values such as `90`, `1:30`, `1h`, `1.5h` and `1h 30m`.
- (#2484) Fixed collapsed Kanban columns expanding again after Obsidian restarts or the view reloads. Collapsed columns are now saved in the view's `.base` configuration, like column order. See [Collapsing Columns](https://tasknotes.dev/views/kanban-view/#collapsing-columns)
  - Thanks to @UniCode9696 for reporting this
- (#2489) Fixed natural language parsing reading text inside links as task fields. Dates, tags, contexts and statuses inside wikilinks, markdown links, inline code and URLs are no longer parsed. Converting `- [ ] review [[2026-11-03 Meeting with Jane]]` no longer schedules the task for that date, and converting a line with `[[Project#Next steps]]` no longer adds a `Next` tag or cuts it out of the link. A trigger directly before a link, such as `+[[Project]]`, still applies. See [Natural Language Processing](https://tasknotes.dev/settings/features/#natural-language-processing)
  - Thanks to @Mirrimo for reporting this
- (#2481) Fixed the timeblock edit modal dropping attachments written as links without `.md` (for example `[[Tasks/Write report]]`) when saving. Existing links now keep their original text.
  - Thanks to @ac8318740 for reporting this
- (#2494, #2498) Fixed time entries in the calendar's week and day views squeezing every event on their day, even where nothing overlapped. Time entries now sit in the narrow strip on the right only where they overlap a scheduled task, timeblock or calendar event. Elsewhere, events and time entries use the full column width, as they did before 4.15.
- (#2494) The previous and next buttons in the calendar toolbar now show larger, clearer arrows.
  - Thanks to @RumiaKitinari for reporting both, and @mgreen3 for the related report
- (#2412) Restore distinct failure feedback when recurring-task Undo cannot write a note, rather than reporting a changed-note conflict.
  - Thanks to @PaulSnyder for the recurring-completion feedback request.
- (#2396) Complete the pending recurring occurrence from the list and board keyboard action palette, rather than recording today's date.
  - Thanks to @martin-forge for reporting moved-occurrence identity problems.
