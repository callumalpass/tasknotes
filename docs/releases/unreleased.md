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

## Added

- (#877) Added standard Obsidian CSS classes to settings tab buttons for improved theme compatibility
  - Active tabs now use `is-active` class for proper button states in button-based themes
  - All tab buttons now include `vertical-tab-nav-item` class
  - Fixes issue where themes like Retroma couldn't distinguish active tabs
  - Thanks to @Bregor for the contribution

## Fixed

- (#899) Fixed "Folder for converted tasks" setting being hidden when convert button is disabled
  - Setting now always visible since it affects command palette task conversion
  - Resolves confusion for users who convert tasks via command palette
  - Thanks to @nnnell for the fix

- (#905), (#907) Fixed project filter incorrectly affecting custom field suggestions
  - Custom field wikilink suggestions (`[[`) now show all vault files instead of only filtered projects
  - Task Edit modal now uses consistent hierarchical tag matching with Task Creation modal
  - Made filtering opt-in via `FileFilterConfig` parameter for better separation of concerns
  - Thanks to @renatomen for the thorough fix and comprehensive tests

