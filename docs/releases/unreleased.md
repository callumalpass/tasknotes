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

## Fixed

- TaskNotes now automatically upgrades unmodified TaskNotes-generated mdbase v0.2 collection metadata to the canonical v0.3 task type and contract when the integration is enabled. Existing task notes are not rewritten, custom collection settings are preserved, the previous metadata is backed up, and ambiguous, interrupted, or failed upgrades are safely restored or left for manual review. See [Integrations Settings](https://tasknotes.dev/settings/integrations/#mdbase).
