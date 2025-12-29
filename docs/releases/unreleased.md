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

## Fixed

- (#1386) Fixed `timeEstimateCategory` formula showing "Long (>2h)" instead of "No estimate" for new tasks
  - The condition didn't properly handle null values when `timeEstimate` property is unset
  - Also fixed the same issue in `trackingStatus` formula
  - Thanks to @nicou for reporting and suggesting the fix

- (#1397) Fixed Bases views (Kanban, Calendar, Task List) resetting to Calendar view after a few minutes
  - Views would show "?" in the Views menu due to view type mismatch
  - Caused by typo in view type properties not matching registration IDs
  - Thanks to @music-soul1-1 for reporting
