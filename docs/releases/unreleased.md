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

- (#2436) Added **Use default projects only when no project is specified** under Settings → Task creation → Defaults → Default projects. When it is on, a project you pick or type while creating a task replaces your default projects instead of being added to them, and instant conversion leaves out the defaults when the text names a project. Off by default. See [Task Properties](https://tasknotes.dev/settings/task-properties/).
  - Thanks to @RumiaKitinari for the request

## Fixed

- (#2267) With **Include Obsidian link** on, Google Calendar event descriptions for tasks and timeblocks show a clickable "Open in Obsidian" link again, instead of the `obsidian://` address as plain text. Existing events get the link the next time the task or timeblock is synced. Thanks to @techy-robot for reporting.
- Fixed long Task Lists leaving the bottom of the list blank after a large jump with the scrollbar. The missing rows appeared only after scrolling again.

## Changed

- The plugin's `main.js` is about 295 KB smaller (4.9 MB to 4.6 MB). The Google Calendar sign-in client no longer bundles validation code TaskNotes never uses, including error messages for every language.
- TaskNotes follows more of your theme's styling:
  - Selected tasks use the same highlight as selected files in Obsidian.
  - Keyboard focus outlines use the same colour as Obsidian's own controls.
  - Date and time chips in timeblock dialogs, and priority chips when scheduling unscheduled tasks, use Obsidian's pill style.
  - Menus, pickers, notifications, buttons, and board and group headers use Obsidian's interface text sizes. They no longer grow with the reading font size, and they use Obsidian's larger sizes on mobile.
  - Text no longer goes below 12px.
  - The search field in TaskNotes views uses Obsidian's form field background.
  - A few remaining fixed shadows now come from the theme.
- Dragging tasks in the task list shows less on screen:
  - A small chip with the task's title follows the pointer instead of a full copy of the row. A second line in the chip says what dropping there will do, or why you can't drop there.
  - The "Add as subtask" target is now an icon at the end of the row, so it no longer covers the title of the task you're dropping onto. Over it, the parent row is highlighted and an indented line marks where the subtask will go.
  - The separate floating message next to the pointer is gone. Its text is now in the chip, and "Other projects stay unchanged" was removed.
  - The keyboard focus outline is hidden while dragging, so it can't be mistaken for the drop target.

## Security
