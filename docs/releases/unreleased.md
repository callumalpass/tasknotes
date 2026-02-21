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

- Added `Resume state storage` setting to control where resume state is persisted (plugin data, separate `state.json`, or device-only `localStorage`)
  - Helps Git users avoid sync conflicts/noise by allowing `state.json` to be gitignored

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
