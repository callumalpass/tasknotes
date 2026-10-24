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

- Moved interface translations to Lingui catalogues with count-aware messages, locale-aware numbers and dates, and localized generated Bases labels. Ordinary builds retain all nine bundled interface languages.

- Kept stored default names and reminder descriptions in English, translating unchanged defaults only for display. Restored English `.ics` descriptions and kept persisted Google Calendar metadata in English so exports do not vary with the exporting device’s interface language; user-authored labels are preserved.

- Localized command notices, calendar connection and webhook settings, date/reminder/action/file/timeblock dialogs, task-property pickers, recurrence controls and statistics labels in all eight non-English interface languages. User-authored titles, paths, status labels and property names remain unchanged.

## Removed

## Fixed

- (#2418) Corrected singular agreement in French, Brazilian Portuguese and Russian count labels and recurrence messages; removed mechanically copied optional French/Spanish plural branches.
- (#2418) Kept Kanban and Task List group keys stable across interface languages so moving or creating tasks in empty and boolean columns does not write translated labels into task properties. Default status and priority labels remain editable and survive saving and reloading.
- (#2418) Rejected title-less natural-language input in interactive task-creation dialogs across interface languages while preserving the existing API, MCP, CLI and instant-conversion fallback behaviour. Kept generated MDBASE schemas in stable English, and corrected literal template braces and missing values in task-created and unresolved-project messages.
- (#2418) Restored translated built-in modal field/group labels and default-label inputs and NLP suggestions. Kept completed-date group sorting and API/MCP group keys stable across languages; viewing translated settings does not overwrite stored names. Task cards and cache-miss edit dialogs now share the same missing-title display fallback.

- Prevented stalled language-pack cache reads/writes from leaving language selection and retry stuck, and refreshed ribbon tooltips and accessible names when a preferred language finishes loading after startup.
- Completed Russian and Simplified Chinese calendar attachment and migration messages that still contained English fragments.
