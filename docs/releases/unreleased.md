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

## Added

- (#1342, #1793) Added native tag autocomplete to time entry descriptions by using the embedded markdown editor in the time entry editor modal.
  - Thanks to @renatomen for the PR.
- (#1756, #1798) Added HTTP API support for configured custom user fields so task responses include them and create/update requests can round-trip their values.
  - Thanks to @Treygec for the request and PR.
- (#1777) Added a Modal Fields setting to choose whether Tab/Shift+Tab move focus out of the task details editor or use the markdown editor's indentation behavior.
  - Thanks to @P-Sc for the PR.

## Changed

- Updated the Obsidian API dependency to 1.12.3 and switched the Bases integration to the official API type declarations.
- Bases task cards and property-event cards now render metadata values through Obsidian's native Bases value renderer so links, dates, lists, icons, and formula values display more faithfully.

## Fixed

- (#1786) Fixed TaskNotes task cards and relationships/subtasks widgets appearing inside embedded task-note heading or block sections.
  - Skips note-level widget injection in detached or embedded Markdown editor contexts used by plugins such as Block Link Plus.
  - Thanks to @3zra47 for reporting.
- (#1815) Fixed the Priority property settings so the NLP trigger character field is visible and editable even when priority NLP parsing is disabled.
  - Thanks to @spiv for reporting.
- (#1035) Fixed the task modal title field causing the modal to jump to the bottom when focused on iPhone.
  - Thanks to @3zra47 for reporting and following up.
- (#1045) Fixed inline linked recurring tasks keeping the previous day's completed state after the calendar day changes.
  - Thanks to @3zra47 for reporting and following up.
- (#1788) Fixed Task List subgroup headers and cards rendering without clear indentation.
  - Thanks to @renatomen for the PR.
- (#1810) Updated Japanese Kanban terminology to use the more natural katakana spelling.
  - Thanks to @sigma7863 for the PR.
- (#1633) Fixed Bases task cards using fallback labels instead of Bases display names for mapped task fields and file properties.
  - Thanks to @Sarryaz for reporting the Bases task card i18n and field-mapping issue.
- (#884) Fixed untranslated strings and English placeholder examples across non-English interface translations.
  - Thanks to @berzernberg for reporting Russian translation gaps.
- (#1765, #1769) Fixed auto-archived tasks leaving stale Google Calendar events when cleanup runs before calendar sync is ready or after the task moves into the archive folder.
  - Thanks to @martin-forge for reporting and the PR.
- (#1764) Fixed Google Calendar sync using stale task metadata after rapid task updates, and fixed late recurring completions/skips recording the completion day instead of the scheduled occurrence date.
  - Thanks to @martin-forge for the PR and to @jpmoo for reporting the recurring completion issues.
- Fixed CI test runs resolving the NLP parser package from a local sibling checkout instead of the published dependency.
- Published [`mdbase-tasknotes`](https://github.com/callumalpass/mdbase-tasknotes) 0.1.3 with compatibility fixes for TaskNotes-generated mdbase schemas.
  - Includes clearer create-path diagnostics, natural-language `mtn list --due` filters, timer log datetime filters, home-directory path expansion, project wikilink preservation, and correct `mtn --version` reporting.
  - Thanks to @tparsons9, @anomatomato, @npondel, @plashal, and @waspeer for the reports and PR.
- (#1667) Fixed NLP scheduled-date parsing so standalone `scheduled` and `start` triggers can set scheduled dates alongside due dates.
  - Thanks to @hokfujow for reporting and @UniqueClone for the NLP core PR.
- Fixed NLP parser title cleanup for explicit date triggers and Japanese/Chinese priority phrases.
- (#1658) Fixed Pomodoro stats date bucketing for sessions near local midnight
  - Pomodoro session stats now compare the recorded session calendar date against UTC-anchored target days without shifting through UTC or the reader's current timezone
  - Pomodoro daily-note storage now writes sessions to the daily note matching the recorded session date
  - Thanks to @ewgdg for reporting and @ITblacksheep for PR #1758

- (#1813) Fixed Pomodoro timer UI stalls caused by refreshing session statistics on every timer tick
  - Pomodoro stats now refresh on initial render and session completion instead of once per second
  - Pomodoro daily-note stats now read the relevant date/range instead of routing through all history
  - Native Pomodoro notifications now respect the notification setting and granted permission before showing
  - Thanks to @Szu-Szu for reporting and @its-thex for confirming

- (#1744) Fixed Bases Task List views so changing the per-view `Expanded relationships` option takes effect on re-render
  - Restores the expected `show-all` behavior for setups that hide subtasks at the top level with `note.projects.isEmpty()`
  - Thanks to @minol-dev for reporting and @stanley-910 for PR #1792 exploring the related standalone-subtask workflow
- Fixed tag clicks in task cards opening the task edit modal in addition to the tag search panel, and kept rendered tag metadata on a single row inside task cards.
