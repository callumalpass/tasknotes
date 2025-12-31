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

- Adopted Obsidian 1.11.0 API features with backwards compatibility
  - Settings tab now displays TaskNotes icon in the sidebar (Obsidian 1.11.0+)
  - Settings sections now use native `SettingGroup` for improved visual grouping (Obsidian 1.11.0+)
  - Falls back gracefully to traditional section headers on older Obsidian versions

- (#59) Added `shortYear` template variable for custom filename and folder templates
  - Use `{shortYear}` in filename templates (e.g., "25" for 2025)
  - Use `{{shortYear}}` in folder templates
  - Thanks to @Konosprod for the feature request

- (#1393) Option to prevent auto-creation of default Base view files on startup
  - New "Auto-create default files" toggle in Settings → Integrations → Bases Integration
  - When disabled, deleted sample Base files will not be recreated on plugin load
  - The manual "Create Default Files" button remains available for on-demand recreation
  - Thanks to @LookGoodFeelGood for the feature request

- (#1408) Shift+click on status icon to cycle backwards through statuses
  - Normal click cycles forward through status order
  - Shift+click cycles in reverse order
  - Thanks to @JerryLu086 for the feature request

- Added button tooltips to calendar view toolbar
  - Hovering over navigation and view buttons now shows descriptive hints
  - Buttons include: Today, Previous, Next, Month, Week, Day, Year, List

- Added tooltips to task modal action icons
  - Icon buttons for status, date, project, priority, recurrence, and reminder now show tooltips on hover
  - Improves discoverability for new users

- (#503) Settings now sync automatically across devices via Obsidian Sync
  - Changes to custom statuses, priorities, and other settings apply immediately without restart
  - Thanks to @jhedlund for the feature request and @l-mb for the implementation

- (#1403) Kanban view option to consolidate status icons in column headers
  - New "Show status icon in column header only" toggle in Kanban view settings (disabled by default)
  - When enabled and grouped by status, shows the icon in the column header and hides it on cards
  - Reduces visual redundancy when the column already indicates the status
  - Thanks to @l-mb for the feature request and implementation

## Fixed

- (#1028, #1140, #1152, #1354, #1362) Fixed duplicate task entries appearing in Agenda view
  - Tasks were shown twice: once as TaskNotes events and again as property-based events with a file icon
  - Changed default Agenda template to disable property-based events (`showPropertyBasedEvents: false`)
  - Users can re-enable property-based events in view settings if needed for non-task date properties
  - Thanks to @YIRU69, @jhedlund, @dblinnikov, @Snakiest, @WeiYiAcc, @JacksonMcDonaldDev, @jimbo108108, and @krelltunez for reporting

- (#1386) Fixed `timeEstimateCategory` formula showing "Long (>2h)" instead of "No estimate" for new tasks
  - The condition didn't properly handle null values when `timeEstimate` property is unset
  - Also fixed the same issue in `trackingStatus` formula
  - Thanks to @nicou for reporting and @osxisl for the PR

- (#1397) Fixed Bases views (Kanban, Calendar, Task List) resetting to Calendar view after a few minutes
  - Views would show "?" in the Views menu due to view type mismatch
  - Caused by typo in view type properties not matching registration IDs
  - Also fixed CalendarView corrupting other view files when saving state on unload
  - Thanks to @music-soul1-1 for reporting

- (#1398) Fixed overdue highlight showing on completed tasks
  - Completed tasks with past due dates no longer display overdue styling (red highlight)
  - Respects the "Hide completed from overdue" setting which defaults to true

- (#1363) Fixed calendar view showing nothing when a task has an invalid date format
  - Tasks with malformed dates (e.g., "262025-12-16" instead of "2025-12-16") no longer crash the entire calendar
  - Invalid tasks are now skipped with a console warning, allowing other events to display normally
  - Thanks to @Erelen for reporting

- Fixed today column in week/day calendar views using FullCalendar's default yellow instead of theme accent
  - Today's column now uses a subtle tint of the theme accent color for consistent styling

- (#1399) Fixed drag-and-drop not working in Kanban view on mobile
  - Cards and columns can now be dragged using long-press gesture on touch devices
  - Includes haptic feedback and auto-scroll when dragging near edges
  - Thanks to @l-mb for reporting and the fix

- (#1381) Fixed Pomodoro "Change Task" menu not showing newly created tasks
  - Tasks created while the Pomodoro view was open would not appear in the task selector
  - Improved metadata cache synchronization to properly wait for new files to be indexed
  - Thanks to @Ghosthael for reporting

- (#1344) Fixed "Unsaved Changes" popup appearing randomly when closing task edit modal
  - The popup would appear even when no changes were made to the task
  - Caused by inconsistent trailing whitespace normalization when comparing details content
  - Thanks to @hasanyilmaz for reporting

- (#1402) Fixed Kanban swimlane view showing tasks in wrong column when grouped by formula
  - After editing task metadata, cards would jump to "None" column until Obsidian reload
  - Column assignment now uses Bases' computed grouping instead of cached formula outputs
  - Thanks to @bailob for the fix
