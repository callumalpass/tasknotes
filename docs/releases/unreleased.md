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

## Fixed

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

## Security
