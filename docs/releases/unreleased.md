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

- Mobile task titles use their full row, followed by separate 40px actions and compact metadata. Narrow standalone task references wrap without changing references inside sentences, and settings adapt to their actual pane width.
- Narrow boards include a column navigator with task counts. Batch property pickers show the affected count, task menus link to shortcut help including Undo, and movement toasts name the configured destination and number of tasks.
- Date parsing errors stay beside the input until corrected and are announced to assistive technology. Failed task changes offer an Open task action while retaining Undo for successful changes. Compact editor chips disclose their full labels.
- Calendar appearance settings explain that view-specific overrides are changed in the Base's view settings; existing Bases are left unchanged.
- Task editors, pickers and secondary controls use quieter property surfaces and consistent keyboard, pressed, disabled and touch states. Picker pointer movement no longer scrolls the list or competes with keyboard navigation.
- Settings workflow values can be reordered with Alt+Up/Down from their drag handles. Drag cancellation clears insertion indicators without changing row height; Undo actions remain visibly pending until they finish, and failed property changes receive distinct error feedback.
- Task lists use calmer two-line rows, plain-text metadata, aligned dates and right-aligned section counts. Hover stays still, selection and keyboard focus remain distinct, and mobile row controls have separate touch targets.
- List dragging shows a title and selection count, dims source rows and keeps drop positions stable during background refresh. Dragging a selected row moves the visible selection; Escape cancels without changes, and manual reorder supports Undo. Status controls show pending and failed writes without accepting duplicate clicks.
- Agenda views open with an expandable week-to-month date strip, task-day dots, and an add-task row for each day. The date strip can be turned off in the Base's view options; existing date, filter and display settings still apply.
- Month views offer an optional selected-day panel with the same task status controls and menus as the agenda. The panel sits beside the month in wide panes and below it in narrow panes; it is off by default to preserve existing month-click behaviour.
- Calendar stacks show an appointment count and a hint of their contents. Tracked-time titles no longer split into letter fragments, adjacent appointments have a visible boundary, and calendar move feedback uses localised dates and times. Agenda and mini-calendar selection, focus and drag treatments follow the active Obsidian theme.

- Time-bearing dates stay complete in narrow task rows, with lower-priority metadata yielding space first. Unknown status and priority recovery opens the relevant expanded Task properties section, including from board columns.
- Mini-calendar task choosers use task titles rather than filenames. Calendar collision stacks show appointment counts and expand just their group; narrow weeks reveal the selected day on entry.
- Failed task-property changes identify the property and affected tasks, with a reminder to check note write access before retrying.
- Mobile list and agenda rows keep status beside the title and group metadata and actions on a second row. References inside prose stay inline; standalone references retain their metadata.
- Date pickers open unset dates at the top, precise time inputs use shared focus styling, custom picker labels have room to wrap, and shortcut help retains its keys on phones.
- Statistics group overview metrics evenly and keep period comparisons together. Expanded task modals avoid reserving a side pane for empty details.
- Kanban cards wrap full titles and status headings use two lines. Empty views distinguish missing tasks from filtered results, unknown values link to settings, and movement feedback names the destination.
- Task creation uses concise toast feedback with the existing Open action; row focus, hover and selection remain distinct.
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

- Compact mobile task rows share full-width titles, separate touch controls and metadata across lists, boards and calendars. Passive details glyphs no longer add an empty row, and agenda dates remain readable in full.
- Board details and relationship indicators share the metadata baseline instead of creating an orphan line. Sentence task references stay in the prose flow with an attached, keyboard-accessible menu.
- Collapsed settings cards remove their contents from keyboard navigation. Disclosure buttons announce expansion and restore focus when a section closes.
- Calendar agenda and selected-day entries align consistently across event types. Narrow month overflow counts fit their day cells while retaining descriptive accessible names, and event tooltips stay out of held moves and resizes.
- Task-list search reports the visible and total task counts, including empty results.
- Keyboard focus stays on the same task control when a Task List or Kanban row redraws after an update, instead of dropping to the document and losing the next shortcut.
- Calendar group drags rejected for incompatible date markers show one explanation without attempting the move. Thanks to @mnicolas94 and @Thanatos9404 for the calendar selection discussion (#2435).
- Parent-assignment feedback names the destination task while retaining the shared Undo action, and keyboard movement menus use the configured subgroup labels. Thanks to @iantierney for suggesting Task List movement (#2381).
- Restored the calendar's status-coloured leading edge and subtle, live Kanban status-colour tints, including swimlane headers and cells. Thanks to @nesyeklaf for contributing Kanban status colours (#2260).
- Kept active Kanban drags intact when an appearance or task refresh was already queued, so the drop can finish before the board redraws.
- Kanban titles use two readable lines without competing indicator rails; metadata overflow never displays a zero count after columns settle.
- Keyboard group toggles retain focus after redraws, task selectors show one active row, and the create-task title has one named textbox.
- List drag destinations use configured labels and a single group target with nearby feedback. Failed board moves identify affected tasks without a misleading successful-write count.
- Task forms keep their width when showing more fields. Long property explanations expand inline, statistics distinguish time tracking from completion, and sentence references give status glyphs room beside titles.
- Search placeholders have stronger theme-derived contrast, and default metadata field labels use consistent casing while preserving custom labels.
- Calendar drags released outside a valid date target are cancelled instead of saving the last hovered time. Timeblock Undo updates the displayed times without reopening the view.
- Year calendars keep their date targets inside each month in narrow panes. Agenda date selection no longer scrolls the surrounding workspace, and empty selected days retain their heading.
- Calendar collision stacks show their full occupied interval, short tracked entries keep readable titles, and narrow month calendars keep the selected-day panel visible. Tracked entries show their actual duration rather than the task estimate.
- Kanban uses quieter column headers and readable, wrapping card metadata. Dragged tasks remain dimmed in place, multi-task previews show their count without clipping, and insertion markers stay beside the actual drop position. Formula-based boards explain why a move is unavailable before dropping; edge scrolling works vertically as well as horizontally.
- Narrow task and agenda rows keep dates and their overflow controls within the pane, including larger text sizes.
- Statistics period sections stack in narrow panes instead of squeezing into three columns.
- Calendar Undo publishes restored task data before the next note edit, and partial group Undo identifies the tasks that were not restored.
- Background calendar refreshes preserve open overflow dialogs and active interactions instead of navigating to the date that is already displayed.
- Legacy calendar stack limits retain readable visible appointments at narrower pane widths. Month overflow keeps its focus anchor during refreshes, so Escape returns to the same control.
- Calendar view preferences survive synchronous configuration refreshes, and task creation no longer waits for native metadata indexing before publishing the saved task.
- Sentence task references no longer reserve space for hidden actions or separate adjacent punctuation; standalone references keep their metadata.
- Shared property pickers support Home and End with active-option reveal, and precise date/time dialogs visibly name the Due or Scheduled property.
- Undo confirms the action that was undone without presenting an older change as new; older changes remain available through the Undo shortcut.
- Filtered-empty task views prioritize reviewing Filters over creating a new task.
- Strengthened small task metadata, prioritized desktop titles over low-value chips, and reduced duplicate status decoration in month bars.
- Details editors keep their layout while typing and switch to the content-sensitive split after focus leaves the editor. Timeblock titles now wrap using the task editor's title control.
- Long board headings reveal their complete names with keyboard or touch. Settings, shortcut help and statistics use tighter spacing, with compact accessible empty-period indicators.
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
