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
- The default manual-order metadata property is now `tasknotes_manual_order`, and the setting is labeled "Manual Order" to make its drag-to-reorder role clearer
- Task List drag-to-reorder now blocks formula-group drops and updates list-backed group properties safely during cross-group moves
- Task List drag-to-reorder now computes persisted placement from the visible list order, reducing off-by-one drops when grouped sections or hidden tasks are involved
- Fixed drag-to-reorder rank generation when a view sorts the manual-order field descending, so drops persist in the same direction the list is displayed
- Grouped Task List drag previews now use a real boundary slot, so later group headers move out of the way instead of being overlapped during drag
- Fixed Task List reorder mode swallowing subtask and dependency toggle clicks by treating interactive task-card controls as no-drag targets, with matching drag/pointer cursor feedback
- Fixed Task List drag-to-reorder resolving against expanded subtask/dependency cards instead of the top-level rows, which could shift drops to the wrong task
- Stabilized Task List drag-to-reorder hit-testing so the preview gap no longer shifts the effective drop boundary while you drag
- Grouped Task List drag-to-reorder now resolves a Kanban-style insertion slot per group, so the previewed slot and the persisted drop stay aligned across group headers
- Generated default Kanban, Relationships, and Tasks `.base` files now surface manual ordering by default where the view is task-focused, including a new grouped "Manual Order" task-list view
- Thanks to @ac8318740 for the original drag-to-reorder groundwork in PR #1619
