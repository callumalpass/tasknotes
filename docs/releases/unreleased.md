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
  - Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

-->

## Fixed

- (#768) Fixed calendar view crashes when tasks contain null values in grouping fields
  - Added null/undefined checks in sort comparisons to prevent localeCompare errors
  - Calendar now handles null values in tags, contexts, and custom fields gracefully
  - Thanks to @kmaustral for reporting

- (#601) Fixed Unicode characters not displaying in tags and contexts
  - Unicode characters (Š, Ė, Ž, Ą, etc.) are now properly preserved in tags and contexts
  - Affects Agenda View, Task List View, and all other views displaying tags
  - Thanks to @Kapinekas for reporting

- (#778) Fixed cursor artifacts in CodeMirror widgets
  - Thanks to @jhedlund for the fix

- Fixed task card widgets in note editor not updating for archive and time tracking changes
  - Task card widgets now properly detect when tasks are archived/unarchived
  - Task card widgets now properly detect when time tracking starts/stops
  - Blue "tracking" border now appears/disappears correctly in live preview
  - Archive styling now updates correctly in live preview

## Changed

- (#751) Status bar tracked task click behavior now opens task notes directly
  - Single tracked task: opens the task note immediately
  - Multiple tracked tasks: shows selector modal to choose which task note to open
  - Provides faster access to tracked tasks compared to previous task list view

- Improved link handling throughout the plugin using Obsidian's native APIs
  - Replaced manual wikilink generation with `FileManager.generateMarkdownLink()`
  - Now respects user's link format settings (wikilink vs markdown, relative paths)
  - Replaced manual link parsing with `parseLinktext()` for proper alias handling
  - Better compatibility with future Obsidian updates
  - Added centralized link utilities in `linkUtils.ts`

- Refactored widget cursor styles into reusable utility class
  - Consolidated shared CSS into .cm-widget-cursor-fix utility
  - Improved maintainability across widget components

