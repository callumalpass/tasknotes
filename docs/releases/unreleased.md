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

- Added **Show all properties on task cards** (Settings → Appearance & interaction → Task cards). When it is on, properties that do not fit on a narrow card wrap onto extra lines instead of being hidden behind a count such as +3, as they did in 4.x. Task links in notes have their own setting, below. See [Appearance settings](https://tasknotes.dev/settings/appearance/).
  - Thanks to @dh-gh-1 for the suggestion (#2583)
- Added **Show all properties on inline task cards** (Settings → Appearance & interaction → Inline tasks). When it is on, a task link on its own line in a note lists every selected property on extra lines under its title, instead of hiding the ones that do not fit behind a count such as +3. It is off by default, so task links stay on one line, and links inside a sentence still show only the title. **Attachments** can now be chosen in **Inline task card properties** and **Default visible properties**, and appear as links named by their file. See [Inline tasks](https://tasknotes.dev/features/inline-tasks/).
  - Thanks to @dh-gh-1 for the suggestions (#2595, #2597)

## Fixed

- Fixed tracked-time blocks in the calendar hiding the task title unless the block was very short. The title now appears beside the status icon, as it does on scheduled tasks.
- Fixed expanded subtasks of a task with no dates or properties being squeezed onto one line, with their dates and properties overlapping the title. Subtasks now keep their own layout.
- (#2579) Fixed task links on their own line in Live Preview taking up about three lines each, with blank space above and below the task and list bullets pushed onto a separate line. Each task now takes one line again, as it did in 4.x.
  - Thanks to @BrucePlumb for reporting
- (#2587) Fixed TaskNotes Bases views embedded in a note in the right sidebar keeping the note's side margins and scrolling separately from the note, a regression of #765. Embedded task lists in either sidebar again span its full width, in Reading view and now also in Live Preview.
  - Thanks to @TonyAtlas for reporting
- (#2581) Fixed task cards in Bases views showing "Normal" priority, with the Normal colour, for notes that have no priority property. These cards now show no priority, which matches how Bases sorts and filters the missing property and how the default priority formulas rank it (below every configured priority).
  - Thanks to @arthurhfcardoso for reporting
- Fixed tags, contexts, projects and attachments in task links in notes stacking one per line or running together, such as "@studio@phone". They now sit in a row with a space between them, as on task cards in Bases views.
- Fixed task links in notes not updating after a change to **Inline task card properties** until the note was reopened.

## Changed

- Task cards that show the attachments property now list each attachment as a link named by its file, such as *Quarterly report.pdf*, instead of its full vault path. Each name fits, collapses into the +N count, or wraps like any other property, and the paperclip count is no longer shown alongside the names. To show attachment names, add **attachments** to the view's properties. See [Appearance settings](https://tasknotes.dev/settings/appearance/).
  - Thanks to @dh-gh-1 for the suggestion (#2584)
- The two-pane task modal (Create with More fields, and Edit) now uses the window's available height, up to 900px, instead of a fixed 540px, so fields, attachments and details need less scrolling. It still keeps one height when More fields opens.
  - Thanks to @dh-gh-1 for the suggestion (#2585)

## Security
