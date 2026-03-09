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

- (#1720) Fixed Bases Task List cards showing Lucide icon tokens such as `clock` instead of formatted date-like values, and fixed generic property labels to use configured Bases display names instead of raw property IDs
  - Thanks to @Sirnii for reporting
- (#1633) Fixed interactive Task Card labels and ribbon labels so Bases-backed cards use translated labels and configured Bases display names instead of hardcoded English/raw property IDs
  - Thanks to @Sarryaz for reporting
- (#1651) Fixed date `is` query filtering so date-only searches also match timed `scheduled` and `due` values during TaskManager prefiltering
  - Thanks to @36mimu36 for reporting
- (#1644) Fixed generated default task views so recurring tasks without a `complete_instances` property are still treated as incomplete and appear in views like This Week, Today, and Overdue
  - Thanks to @bkennedy-improving for reporting
- Updated generated `_types/task.md` mdbase schema output so `dateCreated` and `dateModified` include generated values (`now` and `now_on_write`) for automatic timestamp handling on create/write
- Fixed documentation deployment CI failures caused by `docs-builder/src/js/main.js` being excluded by a broad `.gitignore` `main.js` rule
  - Added a specific unignore rule so the docs site client script is tracked and available in GitHub Actions builds
- Reduced long-running performance risk from calendar sync token persistence by avoiding full runtime settings side-effects during background sync writes
- Prevented duplicate auto-stop time tracking listeners from accumulating when settings are reloaded or changed
- Fixed a settings Integrations listener lifecycle issue that could accumulate calendar update callbacks while the settings UI is repeatedly opened/re-rendered
- (#1630) Fixed TaskNote inline task cards ignoring centered "Readable line length" layout in Minimal theme by constraining and centering the widget in readable mode
  - Thanks to @martin-forge for reporting
- Consolidated documentation cleanup for accuracy and clarity across API, webhook, NLP, privacy, settings, and view docs (corrected outdated endpoint/behavior details, normalized current settings paths, and tightened non-release prose)
- Fixed a broken docs cross-reference from Property Types Reference to Task Properties settings
- Fixed docs site link generation so internal Markdown links resolve to route URLs instead of broken `.md` paths (for example `/views/default-base-templates/`)
- Fixed docs release-note links by building all Markdown docs pages, including pages not listed directly in sidebar nav
- Drag-to-reorder now scopes Kanban ordering to the active swimlane, initializes sparse manual ordering using the visible drag order, rebalances oversized sort keys back to compact LexoRank values, and warns before large multi-note reorder writes
- Task List drag-to-reorder now blocks formula-group drops and updates list-backed group properties safely during cross-group moves
- Grouped Task List drag previews now keep the landing gap inside the hovered group instead of shifting unrelated groups
- Thanks to @ac8318740 for the original drag-to-reorder groundwork in PR #1619
