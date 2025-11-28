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

- (#1010, #1126) Added batch task selection and editing in Task List and Kanban views
  - Shift+click to select multiple tasks
  - Right-click selected tasks to open batch context menu
  - Batch operations: change status, priority, due date, scheduled date, archive, delete
  - Drag multiple selected cards in Kanban to move them together
  - Click the selection count indicator to clear selection
  - Press Escape to exit selection mode
  - Thanks to @jalooc and @solidabstract for the feature requests

- (#1207) Added inline search box to Bases views (Task List, Kanban, Calendar)
  - Enable via "Enable search box" toggle in view settings
  - Searches across title, status, priority, tags, contexts, projects, and visible custom properties
  - Press Escape or click × to clear search
  - Thanks to @renatomen for the PR

- (#363) Added "Create or open task" command with NLP-based quick task creation
  - Open via command palette or assign a hotkey
  - Search existing tasks or type natural language to create new tasks (e.g., "Buy groceries tomorrow #shopping")
  - Press Enter to select an existing task, Shift+Enter to create a new task
  - Real-time preview shows parsed title, due date, priority, tags, and other metadata
  - Thanks to @luciolebrillante for the feature request

## Changed

- Improved inline task conversion to merge TasksPlugin and NLP parsing results
  - Previously, if a task had hashtags (e.g., `- [ ] Buy milk tomorrow #groceries`), NLP parsing was skipped entirely
  - Now NLP always parses the clean title to extract dates/times, then merges with TasksPlugin-extracted metadata
  - TasksPlugin explicit values (emoji dates like 📅) take priority over NLP-inferred values
  - Tags, contexts, and projects from both sources are combined and deduplicated

- Polished task card styling for a cleaner, more native Obsidian look
  - Simplified hover and focus states to use native Obsidian colors
  - Removed blur filter and shadows from metadata pills
  - Fixed subtask chevron vertical alignment with status dot
  - Reduced swimlane label column width in Kanban view

## Fixed

- (#1157) Fixed inline task embeds breaking layout when placed in indented bullet lists
  - Task titles now wrap naturally within line boundaries instead of forcing the entire card to a new line
  - Metadata (dates, tags, etc.) stays inline when space permits, with horizontal scrolling on hover when needed
  - Icons now scale with editor font size for consistent appearance
  - Thanks to @3zra47 for reporting

- (#1241) Fixed deleting custom priorities in settings removing the wrong priority when multiple priorities exist
  - Thanks to @Anthonyhunter100 for reporting

- (#1165) Fixed Kanban view grouping by list properties (contexts, tags, projects) treating multiple values as a single combined column
  - Tasks with multiple values now appear in each individual column (e.g., a task with `contexts: [work, call]` appears in both "work" and "call" columns)
  - Added "Show items in multiple columns" option (enabled by default) to control this behavior
  - Fixed drag-and-drop to properly add/remove individual values instead of replacing the entire list
  - Fixed swimlane mode to also respect list property explosion
  - Thanks to @dictionarymouse for reporting

- (#1217) Fixed inconsistent Ctrl+Click/Cmd+Click behavior for opening notes in new tabs
  - Note cards and internal links now properly support Ctrl/Cmd+Click to open in new tab
  - Added middle-click support for opening in new tab
  - Thanks to @diegomarzaa for reporting

- (#1265) Fixed task edit modal corrupting markdown-style project links on save
  - Links like `[Project Name](path.md)` were being wrapped in extra brackets: `[[[Project Name](path.md)]]`
  - Plain text project names are now preserved as-is instead of being converted to wikilinks
  - Thanks to @minchinweb for reporting

