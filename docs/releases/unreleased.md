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

- Added an opt-in build mode for downloadable interface language packs, with bundled English, validated local caching for offline use, and retry support. Ordinary builds continue bundling all supported languages. Versioned public hosting, a guarded operator publisher, and conditional-create publication tooling are available for experimental builds. Publication rejects permission errors even when identical objects already exist. See [Downloadable language packs](https://tasknotes.dev/development/language-packs/) for build configuration.

## Changed

- Localized command notices, calendar connection and webhook settings, date/reminder/action/file/timeblock dialogs, task-property pickers, recurrence controls and statistics labels in all eight non-English interface languages. User-authored titles, paths, status labels and property names remain unchanged.

## Removed

## Fixed

- Prevented stalled language-pack cache reads/writes from leaving language selection and retry stuck, and refreshed ribbon tooltips and accessible names when a preferred language finishes loading after startup.
- Completed Russian and Simplified Chinese calendar attachment and migration messages that still contained English fragments.
