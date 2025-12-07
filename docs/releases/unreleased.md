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

## Fixed

- Significant performance improvements for Bases views (TaskList, Kanban, Calendar)
  - Reduced `extractDataItems` time from ~4 seconds to ~5-10ms for large vaults (6000+ tasks)
  - Computed file properties (`file.backlinks`, `file.links`, etc.) are now fetched lazily during render instead of upfront
  - Only visible items (with virtualization) trigger expensive property computations
  - Added debouncing to `onDataUpdated` to prevent UI freezes during typing
  - Added visibility checks to skip rendering hidden views
  - Debounced metadata change handlers in editor decorations
  - Timeblock generation now uses Obsidian's metadataCache instead of file reads
  - Added date range filtering for calendar events to skip events outside visible range
  - (#1285) Calendar view uses 5-second debounce to prevent flickering while typing
	  - Thanks to @steven-murray for reporting
- (#1319) Added missing properties to Field Mapping settings
  - `recurrence_anchor` - now in Settings > Task Properties > Task Details
  - `skipped_instances` - now in Settings > Task Properties > Metadata Properties
  - Thanks to @kazerniel for reporting
- (#1310) Fixed inline task conversion deleting text when task title exceeds filename limits
  - Text that cannot fit in the filename is now preserved in the task note's body
  - Truncation respects word boundaries when possible for cleaner titles
  - Thanks to @prayidae for reporting
- (#1301) Fixed inline task wikilinks leaving blank space when no metadata properties are visible
  - Thanks to @Richard-UMPV for reporting
- (#1317) Fixed project autosuggest filters not working correctly when only "Required Property Key" is configured
  - NLP `+` trigger now properly filters by property existence when no property value is specified
  - Modal "Add to project" button now shows consistent results with inline autosuggest
- (#1287, #1307) The "New" button in Bases views now opens the TaskNotes creation modal
  - Tasks created from Bases views now respect default properties (status, priority, etc.)
  - Tasks are now created in the configured default folder instead of the views folder
  - Thanks to @anareaty and @sylvainfct-dot for reporting

## Changed

- Reorganized settings panel for improved discoverability
  - Removed "Defaults" tab - default values are now configured alongside each property in the Task Properties tab
  - Moved task filename format settings to the Title property section
  - Moved project autosuggest settings to the Projects property section
  - Body template setting moved to the Features tab
  - Added descriptions to each property explaining its purpose

